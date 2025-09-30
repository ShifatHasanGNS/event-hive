const schemaContext = require('./schema-context');

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

const SYSTEM_PROMPT = `You are EventHive's SQL co-pilot. Convert natural language prompts into safe, efficient PostgreSQL queries or PL/pgSQL blocks that work with the provided schema. Always:
1. Use only the columns, tables, and relationships described in the schema context.
2. Prefer SELECT statements; only create functions or use DML when the user explicitly requests modifications.
3. When the user asks for narrative/textual insight, append a DO $$ BEGIN ... END $$ block that RAISES NOTICE with the final sentence(s) so the UI can display text output.
4. Wrap complex logic (multiple steps, temporary tables) into explicit statements provided individually.
5. NEVER drop or truncate tables. Avoid destructive statements.
6. Ensure every statement you generate ends with a semicolon.
7. Each statement must be executable on its own without relying on implicit state.
8. Return JSON that matches the documented shape exactly.

Schema Context:
${schemaContext}

Required JSON structure:
{
  "title": "Short descriptive title",
  "objective": "One sentence summary of what the SQL does",
  "statements": ["SQL or PL/pgSQL statement 1;", "SQL statement 2;"],
  "notes": ["Optional execution notes", "Mention if DDL or DML"],
  "result_expectation": "Describe whether the output will be tabular data or plain text"
}
If several statements are needed, order them in the execution sequence. Always escape embedded quotes properly.`;

async function generateSqlFromPrompt(userPrompt) {
  if (!userPrompt || !userPrompt.trim()) {
    throw new Error('Prompt cannot be empty.');
  }

  const payload = {
    system_instruction: {
      role: 'system',
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `User request: ${userPrompt}\n\nRespond only with valid JSON matching the required structure. Do not include markdown fences or prose outside the JSON.`,
          },
        ],
      },
    ],
    generation_config: {
      temperature: 0.1,
      top_p: 0.8,
      top_k: 32,
      response_mime_type: 'application/json',
      max_output_tokens: 2048,
    },
  };

  const response = await fetch(getGeminiEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const candidateText =
    data?.candidates?.[0]?.content?.parts?.map((part) => part?.text).join('') || '';

  if (!candidateText) {
    throw new Error('Gemini did not return a usable response.');
  }

  let parsed;
  try {
    parsed = JSON.parse(candidateText);
  } catch (err) {
    throw new Error(`Gemini response was not valid JSON: ${err.message}`);
  }

  const normalized = normalizePlan(parsed);

  return {
    ...normalized,
    raw: candidateText,
  };
}

function normalizePlan(plan) {
  if (!plan || typeof plan !== 'object') {
    throw new Error('Gemini response was not an object.');
  }

  const title = typeof plan.title === 'string' ? plan.title.trim() : 'AI Generated Query';
  const objective = typeof plan.objective === 'string' ? plan.objective.trim() : '';

  let statements = Array.isArray(plan.statements) ? plan.statements : [];
  if (!statements.length && typeof plan.statement === 'string') {
    statements = [plan.statement];
  }

  if (!statements.length && typeof plan.sql === 'string') {
    statements = plan.sql.split(';').map((item) => `${item.trim()};`).filter((item) => item.length > 1);
  }

  statements = statements
    .map((stmt) => (typeof stmt === 'string' ? stmt.trim() : ''))
    .filter(Boolean)
    .map((stmt) => (stmt.endsWith(';') ? stmt : `${stmt};`));

  if (!statements.length) {
    throw new Error('Gemini response did not provide any SQL statements.');
  }

  const notes = Array.isArray(plan.notes)
    ? plan.notes.filter((note) => typeof note === 'string' && note.trim()).map((note) => note.trim())
    : [];

  const expectation =
    typeof plan.result_expectation === 'string'
      ? plan.result_expectation.trim()
      : 'Results depend on the executed SELECT statements.';

  return {
    title,
    objective,
    statements,
    notes,
    resultExpectation: expectation,
  };
}

function getGeminiEndpoint() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Provide your Google Gemini API key in the environment.');
  }

  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
}

module.exports = {
  generateSqlFromPrompt,
};

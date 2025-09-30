const express = require('express');
const { generateSqlFromPrompt } = require('../services/gemini');
const { executeStatements } = require('../utils/db');

const router = express.Router();

const FORBIDDEN_KEYWORDS = ['DROP TABLE', 'DROP DATABASE', 'TRUNCATE', 'ALTER SYSTEM', 'ALTER DATABASE', 'DROP SCHEMA'];

router.post('/generate', async (req, res) => {
  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  try {
    const normalizedPrompt = prompt.trim();
    const plan = await generateSqlFromPrompt(normalizedPrompt);

    validateStatements(plan.statements);
    enforceGuards(plan.statements);

    return res.json({
      prompt: normalizedPrompt,
      plan,
    });
  } catch (error) {
    console.error('SQL generation failed:', error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: error.message || 'Failed to generate SQL for the prompt.',
    });
  }
});

router.post('/execute', async (req, res) => {
  const { statements: rawStatements, sql } = req.body || {};

  try {
    const statements = coerceStatements(rawStatements, sql);

    validateStatements(statements);
    enforceGuards(statements);

    const executionStart = process.hrtime.bigint();
    const { notices, results } = await executeStatements(statements);
    const executionEnd = process.hrtime.bigint();
    const executionTimeMs = Number(executionEnd - executionStart) / 1_000_000;

    return res.json({
      statements,
      notices,
      results,
      executionTimeMs,
    });
  } catch (error) {
    console.error('Query execution failed:', error);
    return res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to execute the provided SQL statements.',
    });
  }
});

function validateStatements(statements) {
  if (!Array.isArray(statements) || !statements.length) {
    throw new Error('No SQL statements were generated for execution.');
  }

  for (const statement of statements) {
    if (typeof statement !== 'string' || !statement.trim()) {
      throw new Error('Generated statements must be non-empty strings.');
    }
  }
}

function enforceGuards(statements) {
  for (const statement of statements) {
    if (shouldBlockStatement(statement)) {
      const error = new Error(`Blocked potentially destructive statement: ${statement}`);
      error.statusCode = 400;
      throw error;
    }
  }
}

function shouldBlockStatement(statement) {
  const normalized = statement.toUpperCase();
  return FORBIDDEN_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function coerceStatements(rawStatements, sqlText) {
  if (typeof sqlText === 'string' && sqlText.trim()) {
    return splitSqlText(sqlText);
  }

  if (Array.isArray(rawStatements) && rawStatements.length) {
    return rawStatements;
  }

  if (typeof rawStatements === 'string' && rawStatements.trim()) {
    return splitSqlText(rawStatements);
  }

  return Array.isArray(rawStatements) ? rawStatements : [];
}

function splitSqlText(sqlText) {
  if (!sqlText || typeof sqlText !== 'string') {
    return [];
  }

  const statements = [];
  let current = '';
  let i = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarQuoteTag = null;

  const text = sqlText;
  const length = text.length;

  while (i < length) {
    const char = text[i];
    const nextChar = i + 1 < length ? text[i + 1] : '';

    if (inLineComment) {
      current += char;
      if (char === '\n') {
        inLineComment = false;
      }
      i += 1;
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === '*' && nextChar === '/') {
        current += nextChar;
        inBlockComment = false;
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    if (dollarQuoteTag) {
      current += char;
      if (char === '$') {
        const potentialTag = text.slice(i, i + dollarQuoteTag.length);
        if (potentialTag === dollarQuoteTag) {
          current += potentialTag.slice(1);
          i += dollarQuoteTag.length;
          dollarQuoteTag = null;
          continue;
        }
      }
      i += 1;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '-' && nextChar === '-') {
        current += char + nextChar;
        inLineComment = true;
        i += 2;
        continue;
      }

      if (char === '/' && nextChar === '*') {
        current += char + nextChar;
        inBlockComment = true;
        i += 2;
        continue;
      }

      if (char === '$') {
        const tag = readDollarQuoteTag(text, i);
        if (tag) {
          dollarQuoteTag = tag;
          current += tag;
          i += tag.length;
          continue;
        }
      }
    }

    if (char === '\'') {
      current += char;
      if (!inDoubleQuote) {
        if (inSingleQuote && nextChar === '\'') {
          current += nextChar;
          i += 2;
          continue;
        }
        inSingleQuote = !inSingleQuote;
      }
      i += 1;
      continue;
    }

    if (char === '"') {
      current += char;
      if (!inSingleQuote) {
        if (inDoubleQuote && nextChar === '"') {
          current += nextChar;
          i += 2;
          continue;
        }
        inDoubleQuote = !inDoubleQuote;
      }
      i += 1;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === ';') {
      const trimmed = `${current.trim()}${char}`.trim();
      if (trimmed.length) {
        statements.push(trimmed);
      }
      current = '';
      i += 1;
      continue;
    }

    current += char;
    i += 1;
  }

  const remaining = current.trim();
  if (remaining.length) {
    statements.push(remaining.endsWith(';') ? remaining : `${remaining};`);
  }

  return statements;
}

function readDollarQuoteTag(text, startIndex) {
  if (text[startIndex] !== '$') return null;
  let end = startIndex + 1;
  while (end < text.length && text[end] !== '$' && /[a-zA-Z0-9_]/.test(text[end])) {
    end += 1;
  }
  if (end < text.length && text[end] === '$') {
    return text.slice(startIndex, end + 1);
  }
  return null;
}

module.exports = router;

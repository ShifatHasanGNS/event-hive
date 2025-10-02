const promptForm = document.getElementById('prompt-form');
const promptInput = document.getElementById('prompt');
const clearButton = document.getElementById('clear-input');
const generateButton = document.getElementById('generate-button');
const systemMessages = document.getElementById('system-messages');
const messageTemplate = document.getElementById('message-template');
const resultsContainer = document.getElementById('results-container');
const resultsSummary = document.getElementById('results-summary');
const resultsStats = document.getElementById('results-stats');
const errorBanner = document.getElementById('error-banner');
const copySqlBtn = document.getElementById('copy-sql-btn');
const runSqlButton = document.getElementById('run-sql-button');
const generatedSql = document.getElementById('generated-sql');
const clearSqlButton = document.getElementById('clear-sql');
const copyPromptButton = document.getElementById('copy-prompt');
const toastContainer = document.getElementById('toast-container');

let currentPlan = null;
const formatter = typeof window !== 'undefined' ? window.sqlFormatter : null;

init();

function init() {
  setGenerateEnabled(hasPromptInput());
  setExecuteEnabled(false);
  updatePromptActions();
  updateSqlActions();

  promptForm.addEventListener('submit', handleSubmit);
  copySqlBtn.addEventListener('click', handleCopySql);
  clearButton.addEventListener('click', handleClearInput);
  promptInput.addEventListener('input', handlePromptInput);
  runSqlButton.addEventListener('click', handleExecuteSql);
  generatedSql.addEventListener('input', handleSqlInput);
  clearSqlButton.addEventListener('click', handleClearSql);
  copyPromptButton.addEventListener('click', handleCopyPrompt);
}

async function handleSubmit(event) {
  event.preventDefault();
  const prompt = promptInput.value.trim();

  if (!prompt) {
    showError('Please enter a question before generating SQL.');
    return;
  }

  hideError();
  prepareForGeneration();
  setGenerateLoading(true);

  try {
    const response = await fetch('/api/query/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    const payload = await response.json();

    if (!response.ok) {
      const message = payload?.error || 'Request failed.';
      if (payload?.code === 'GUARD_BLOCKED') {
        showToast(message);
      } else {
        showError(message);
      }
      resultsSummary.textContent = 'Execution failed. Review the SQL and try again.';
      return;
    }

    const formattedPlan = formatPlanForDisplay(payload.plan);

    currentPlan = formattedPlan;

    renderQueryPlan(formattedPlan);
    renderSystemMessages(formattedPlan, []);
    setExecuteEnabled(hasSqlInput());
    updateSqlActions();
    renderPendingExecution();
    resultsSummary.textContent = 'SQL generated. Execute the statements to see results.';
    resultsStats.innerHTML = '';
  } catch (error) {
    console.error(error);
    currentPlan = null;
    generatedSql.value = '-- SQL generation failed.';
    generatedSql.dataset.generatedSql = '';
    setExecuteEnabled(false);
    updateSqlActions();
    resultsSummary.textContent = 'SQL generation failed. Adjust your prompt and try again.';
    showError(error.message || 'Unable to generate SQL.');
  } finally {
    setGenerateLoading(false);
    setGenerateEnabled(hasPromptInput());
    updatePromptActions();
  }
}

async function handleExecuteSql() {
  const sqlText = generatedSql.value.trim();

  if (!sqlText) {
    showError('Enter SQL before attempting to execute it.');
    return;
  }

  hideError();
  setExecuteLoading(true);
  resultsSummary.textContent = 'Executing SQL statements...';
  resultsStats.innerHTML = '';
  resultsContainer.innerHTML = '';
  generatedSql.dataset.generatedSql = generatedSql.value;
  updateSqlActions();

  try {
    const response = await fetch('/api/query/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        statements: currentPlan?.statements || [],
        sql: generatedSql.value,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error || 'Request failed.');
    }

    if (Array.isArray(payload.statements) && currentPlan) {
      const formattedStatements = payload.statements.map((statement) => formatGeneratedStatement(statement));
      currentPlan = { ...currentPlan, statements: formattedStatements };
    }

    renderResults(payload.results || []);
    renderSystemMessages(currentPlan, payload.notices || []);
    updateResultsSummary(payload, currentPlan);
  } catch (error) {
    console.error(error);
    showError(error.message || 'Unable to execute SQL statements.');
    resultsSummary.textContent = 'Execution failed. Review the SQL and try again.';
  } finally {
    setExecuteLoading(false);
    setExecuteEnabled(hasSqlInput());
    updateSqlActions();
  }
}

function renderQueryPlan(plan) {
  if (!plan || !Array.isArray(plan.statements)) {
    generatedSql.value = '-- No SQL generated.';
    generatedSql.dataset.generatedSql = '';
    updateSqlActions();
    return;
  }

  const formatted = plan.statements.join('\n\n');
  generatedSql.value = formatted;
  generatedSql.dataset.generatedSql = formatted;
  generatedSql.scrollTop = 0;
  updateSqlActions();
}

function formatPlanForDisplay(plan) {
  if (!plan || !Array.isArray(plan.statements)) {
    return plan;
  }

  const formattedStatements = plan.statements.map((statement) => formatGeneratedStatement(statement));
  return {
    ...plan,
    statements: formattedStatements,
  };
}

function formatGeneratedStatement(statement) {
  if (typeof statement !== 'string') {
    return '';
  }

  const original = statement.trim();
  if (!original) {
    return '';
  }

  if (/\$\$/g.test(original) || /^\s*DO\s+/i.test(original)) {
    return ensureStatementSemicolon(original);
  }

  const formatterAvailable = formatter && typeof formatter.format === 'function';
  if (!formatterAvailable) {
    return ensureStatementSemicolon(original);
  }

  try {
    const hasSemicolon = /;\s*$/.test(original);
    const core = hasSemicolon ? original.replace(/;\s*$/, '') : original;
    const formatted = formatter.format(core, {
      language: 'postgresql',
      uppercase: true,
      linesBetweenQueries: 1,
    });
    const normalized = formatted.replace(/\s+$/g, '').trim();
    return hasSemicolon ? `${normalized};` : normalized;
  } catch (error) {
    console.warn('SQL formatting failed, falling back to raw statement.', error);
    return ensureStatementSemicolon(original);
  }
}

function ensureStatementSemicolon(statement) {
  const trimmed = typeof statement === 'string' ? statement.trim() : '';
  if (!trimmed) {
    return '';
  }

  return /;\s*$/.test(trimmed) ? trimmed : `${trimmed};`;
}

function renderSystemMessages(plan, notices) {
  systemMessages.innerHTML = '';

  const listItems = [];

  if (plan?.objective) {
    listItems.push({ label: 'Objective', message: plan.objective });
  }

  if (Array.isArray(plan?.notes)) {
    plan.notes.forEach((note, index) => {
      listItems.push({ label: `Note ${index + 1}`, message: note });
    });
  }

  if (plan?.resultExpectation) {
    listItems.push({ label: 'Expectation', message: plan.resultExpectation });
  }

  if (Array.isArray(notices) && notices.length) {
    notices.forEach((notice, index) => {
      listItems.push({ label: `Notice ${index + 1}`, message: notice });
    });
  }

  if (!listItems.length) {
    systemMessages.innerHTML = `
      <li class="rounded-2xl border border-white/5 bg-brand-950/60 px-4 py-3 text-sm text-brand-300">
        No messages received from Gemini or PostgreSQL.
      </li>
    `;
    return;
  }

  listItems.forEach(({ label, message }) => {
    const node = buildMessageNode(label, message);
    systemMessages.appendChild(node);
  });
}

function buildMessageNode(label, message) {
  if (!messageTemplate?.content) {
    const fallback = document.createElement('li');
    fallback.className = 'rounded-2xl border border-white/5 bg-brand-950/60 px-4 py-3';
    fallback.innerHTML = `
      <p class="text-xs uppercase tracking-[0.3em] text-brand-500">${label}</p>
      <p class="mt-2 text-sm text-brand-200">${message}</p>
    `;
    return fallback;
  }

  const fragment = messageTemplate.content.cloneNode(true);
  const container = fragment.querySelector('li');
  const labelNode = container.querySelector('p:first-child');
  const bodyNode = container.querySelector('p:last-child');
  labelNode.textContent = label;
  bodyNode.textContent = message;
  return fragment;
}

function renderResults(results) {
  resultsContainer.innerHTML = '';

  if (!Array.isArray(results) || !results.length) {
    const placeholder = document.createElement('div');
    placeholder.className =
      'rounded-2xl border border-white/5 bg-brand-950/50 px-5 py-8 text-center text-sm text-brand-300';
    placeholder.textContent = 'No result sets returned for this query. If you executed DDL, check the system messages.';
    resultsContainer.appendChild(placeholder);
    return;
  }

  results.forEach((result, index) => {
    const card = document.createElement('article');
    card.className = 'space-y-5 rounded-2xl border border-white/5 bg-brand-950/60 p-5 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.8)]';

    const header = document.createElement('header');
    header.className = 'flex flex-wrap items-center justify-between gap-3';

    const title = document.createElement('div');
    title.innerHTML = `
      <p class="text-xs uppercase tracking-[0.3em] text-brand-500">Result ${index + 1}</p>
    `;
    header.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'flex flex-wrap items-center gap-2 text-xs text-brand-400';
    meta.innerHTML = `
      <span class="badge">${result.rowCount || 0} row${result.rowCount === 1 ? '' : 's'}</span>
      <span class="badge">${formatDuration(result.durationMs)} ms</span>
      <span class="badge">${(result.command || 'STATEMENT').toUpperCase()}</span>
    `;
    header.appendChild(meta);

    card.appendChild(header);

    const hasRows = Array.isArray(result.rows) && result.rows.length;

    if (hasRows) {
      const tableWrapper = document.createElement('div');
      tableWrapper.className = 'custom-scrollbar overflow-x-auto rounded-2xl border border-white/5 bg-brand-950/40';

      const table = document.createElement('table');
      table.className = 'min-w-full divide-y divide-white/5 text-sm';

      const thead = document.createElement('thead');
      thead.className = 'bg-white/5 backdrop-blur';
      const headerRow = document.createElement('tr');
      getColumnNames(result).forEach((name) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.className = 'whitespace-nowrap px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-brand-200';
        th.textContent = name;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);

      const tbody = document.createElement('tbody');
      tbody.className = 'divide-y divide-white/5';
      result.rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-white/5';
        getColumnNames(result).forEach((name) => {
          const td = document.createElement('td');
          td.className = 'whitespace-nowrap px-4 py-2 text-brand-100';
          td.textContent = formatCellValue(row[name]);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });

      table.appendChild(thead);
      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      card.appendChild(tableWrapper);
    }

    if (result.text && result.text.trim()) {
      const textBlock = document.createElement('pre');
      textBlock.className = 'text-output';
      textBlock.textContent = result.text.trim();
      card.appendChild(textBlock);
    } else if (!hasRows) {
      const message = document.createElement('p');
      message.className = 'text-sm text-brand-300';
      message.textContent =
        result.command && result.command !== 'SELECT'
          ? `${result.command.toUpperCase()} executed successfully.`
          : 'Statement executed without returning rows.';
      card.appendChild(message);
    }

    resultsContainer.appendChild(card);
  });
}

function updateResultsSummary(payload, plan = null) {
  const statementsSource =
    (plan && Array.isArray(plan.statements) && plan.statements) ||
    (payload.plan && Array.isArray(payload.plan.statements) && payload.plan.statements) ||
    (Array.isArray(payload.statements) ? payload.statements : []);

  const statementCount = Array.isArray(statementsSource) ? statementsSource.length : 0;
  const rowsArray = Array.isArray(payload.results) ? payload.results : [];
  const totalRows = rowsArray.reduce((sum, result) => sum + (result.rowCount || 0), 0);
  const runtime = formatDuration(payload.executionTimeMs);

  resultsSummary.textContent = `Executed ${statementCount} statement${statementCount === 1 ? '' : 's'} in ${runtime} ms, returning ${totalRows} total row${totalRows === 1 ? '' : 's'}.`;

  resultsStats.innerHTML = '';
  const stats = [
    { label: 'Statements', value: statementCount },
    { label: 'Rows', value: totalRows },
    { label: 'Runtime', value: `${runtime} ms` },
  ];

  stats.forEach((stat) => {
    const badge = document.createElement('span');
    badge.className = 'stat-badge';
    badge.innerHTML = `<strong>${stat.value}</strong> ${stat.label}`;
    resultsStats.appendChild(badge);
  });
}

function getColumnNames(result) {
  if (Array.isArray(result.fields) && result.fields.length) {
    return result.fields.map((field) => field.name);
  }
  if (Array.isArray(result.rows) && result.rows.length) {
    return Object.keys(result.rows[0]);
  }
  return [];
}

function formatCellValue(value) {
  if (value === null || value === undefined) {
    return '—';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs)) return '0.00';
  return Number(durationMs).toFixed(2);
}

function handleCopySql() {
  const sql = generatedSql.dataset.generatedSql || generatedSql.value || '';
  if (!sql.trim()) {
    return;
  }

  navigator.clipboard
    .writeText(sql)
    .then(() => {
      copySqlBtn.textContent = 'Copied!';
      setTimeout(() => {
        copySqlBtn.textContent = 'Copy';
      }, 2000);
    })
    .catch(() => {
      copySqlBtn.textContent = 'Copy failed';
      setTimeout(() => {
        copySqlBtn.textContent = 'Copy';
      }, 2000);
    });
}

function handleSqlInput() {
  const raw = generatedSql.value || '';
  const trimmed = raw.trim();
  generatedSql.dataset.generatedSql = trimmed ? raw : '';

  const hasSql = hasSqlInput();
  setExecuteEnabled(hasSql);
  updateSqlActions();
}

function handleCopyPrompt() {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    return;
  }

  navigator.clipboard
    .writeText(prompt)
    .then(() => {
      copyPromptButton.textContent = 'Copied!';
      setTimeout(() => {
        copyPromptButton.textContent = 'Copy';
      }, 2000);
    })
    .catch(() => {
      copyPromptButton.textContent = 'Copy failed';
      setTimeout(() => {
        copyPromptButton.textContent = 'Copy';
      }, 2000);
    });
}

function handleClearSql() {
  generatedSql.value = '';
  generatedSql.dataset.generatedSql = '';
  setExecuteEnabled(false);
  updateSqlActions();
}

function hasSqlInput() {
  const stored = generatedSql.dataset.generatedSql || '';
  if (stored.trim()) {
    return true;
  }

  const value = generatedSql.value.trim();
  if (!value) {
    return false;
  }

  const placeholderMessages = ['-- Waiting for Gemini response...', '-- No SQL generated.', '-- SQL generation failed.'];
  return !placeholderMessages.includes(value);
}

function setGenerateLoading(isLoading) {
  generateButton.dataset.loading = String(isLoading);
  generateButton.disabled = isLoading;
}

function setGenerateEnabled(isEnabled) {
  if (generateButton.dataset.loading === 'true') {
    return;
  }

  generateButton.disabled = !isEnabled;
}

function setExecuteLoading(isLoading) {
  runSqlButton.dataset.loading = String(isLoading);
  if (isLoading) {
    runSqlButton.disabled = true;
  }
}

function setExecuteEnabled(isEnabled) {
  if (runSqlButton.dataset.loading === 'true') {
    return;
  }

  runSqlButton.disabled = !isEnabled;
}

function prepareForGeneration() {
  currentPlan = null;
  generatedSql.value = '-- Waiting for Gemini response...';
  generatedSql.dataset.generatedSql = '';
  systemMessages.innerHTML = '';
  resultsContainer.innerHTML = '';
  resultsSummary.textContent = 'Generating SQL...';
  resultsStats.innerHTML = '';
  setExecuteEnabled(false);
  updateSqlActions();
}

function renderPendingExecution() {
  resultsContainer.innerHTML = '';
  const notice = document.createElement('div');
  notice.className =
    'rounded-2xl border border-white/5 bg-brand-950/50 px-5 py-6 text-sm text-brand-300';
  notice.textContent = 'SQL generated. Use Execute Query to run these statements against the database.';
  resultsContainer.appendChild(notice);
}

function showToast(message, duration = 2500) {
  if (!toastContainer || !message) {
    return;
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);

  const dismissAfter = Number.isFinite(duration) ? duration : 2500;
  setTimeout(() => {
    toast.dataset.state = 'closing';
    toast.addEventListener(
      'animationend',
      () => {
        toast.remove();
      },
      { once: true },
    );
  }, dismissAfter);
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.remove('hidden');
}

function hideError() {
  errorBanner.classList.add('hidden');
  errorBanner.textContent = '';
}

function handleClearInput() {
  promptInput.value = '';
  promptInput.focus();
  handlePromptInput();
}

function handlePromptInput() {
  toggleClearButton();
  setGenerateEnabled(hasPromptInput());
}

function toggleClearButton() {
  updatePromptActions();
}

function hasPromptInput() {
  return Boolean(promptInput.value.trim());
}

function updatePromptActions() {
  const hasPrompt = hasPromptInput();
  copyPromptButton.classList.toggle('hidden', !hasPrompt);
  clearButton.classList.toggle('hidden', !hasPrompt);
  if (!hasPrompt) {
    copyPromptButton.textContent = 'Copy';
  }
}

function updateSqlActions() {
  const hasSql = hasSqlInput();
  copySqlBtn.classList.toggle('hidden', !hasSql);
  clearSqlButton.classList.toggle('hidden', !hasSql);
  if (!hasSql) {
    copySqlBtn.textContent = 'Copy';
  }
}

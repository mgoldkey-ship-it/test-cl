(() => {
  const form = document.getElementById('task-form');
  const input = document.getElementById('task-input');
  const error = document.getElementById('form-error');
  const warning = document.getElementById('storage-warning');
  const list = document.getElementById('task-list');
  const empty = document.getElementById('empty-state');
  const initial = TaskStorage.load();
  let tasks = initial.tasks;
  let nextId = 0;

  function showWarning(message) {
    warning.textContent = message;
    warning.hidden = !message;
  }

  function persist() {
    if (!TaskStorage.save(tasks)) {
      showWarning(initial.warning || 'Не удалось сохранить изменения. Они останутся только на этой странице.');
    } else {
      showWarning('');
    }
  }

  function newId() {
    let id;
    do { id = `${Date.now().toString(36)}-${(++nextId).toString(36)}-${Math.random().toString(36).slice(2)}`; }
    while (tasks.some(task => task.id === id));
    return id;
  }

  function render() {
    list.replaceChildren();
    empty.hidden = tasks.length !== 0;
    for (const task of tasks) {
      const item = document.createElement('li');
      item.className = 'task';
      const label = document.createElement('label');
      label.className = 'task-label';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = task.completed;
      const text = document.createElement('span');
      text.className = task.completed ? 'task-text completed' : 'task-text';
      text.textContent = task.text;
      checkbox.addEventListener('change', () => {
        const target = tasks.find(entry => entry.id === task.id);
        if (!target) return;
        target.completed = checkbox.checked;
        text.classList.toggle('completed', target.completed);
        persist();
      });
      label.append(checkbox, text);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'delete-button';
      remove.textContent = 'Удалить';
      remove.setAttribute('aria-label', `Удалить задачу: ${task.text}`);
      remove.addEventListener('click', () => {
        tasks = tasks.filter(entry => entry.id !== task.id);
        persist();
        render();
        input.focus();
      });
      item.append(label, remove);
      list.append(item);
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) {
      error.textContent = 'Введите название задачи.';
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    error.hidden = true;
    input.removeAttribute('aria-invalid');
    tasks.push({ id: newId(), text, completed: false });
    persist();
    render();
    input.value = '';
    input.focus();
  });

  showWarning(initial.warning);
  render();
})();

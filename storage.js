/* Контракт хранения и работа с недоступным хранилищем. */
const TaskStorage = (() => {
  const key = 'todo.tasks.v1';
  let blocked = false;

  function load() {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return { tasks: [], warning: '' };
      const tasks = JSON.parse(raw);
      const ids = new Set();
      if (!Array.isArray(tasks) || !tasks.every(task => {
        if (!task || typeof task.id !== 'string' || !task.id || ids.has(task.id) ||
            typeof task.text !== 'string' || !task.text.trim() ||
            typeof task.completed !== 'boolean') return false;
        ids.add(task.id);
        return true;
      })) throw new Error('Invalid task data');
      return { tasks, warning: '' };
    } catch (error) {
      blocked = true;
      return { tasks: [], warning: 'Не удалось прочитать сохранённые задачи. Изменения останутся только на этой странице; прежние данные не перезаписываются.' };
    }
  }

  function save(tasks) {
    if (blocked) return false;
    try {
      localStorage.setItem(key, JSON.stringify(tasks));
      return true;
    } catch (error) {
      return false;
    }
  }
  return { load, save };
})();

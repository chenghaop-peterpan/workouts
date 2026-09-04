// 動作庫的本機覆寫層(localStorage,mock 模式用)。存整份 exercises 陣列的 override。

const EXERCISE_OVERRIDE_KEY = 'exercise_override';

const ExerciseStore = {
  get() {
    try {
      const raw = localStorage.getItem(EXERCISE_OVERRIDE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  set(list) {
    localStorage.setItem(EXERCISE_OVERRIDE_KEY, JSON.stringify(list));
  },

  reset() {
    localStorage.removeItem(EXERCISE_OVERRIDE_KEY);
  },
};

window.ExerciseStore = ExerciseStore;

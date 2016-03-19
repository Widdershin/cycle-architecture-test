import {div, button, input} from '@cycle/dom';

import isolate from '@cycle/isolate';
import {Observable} from 'rx';

function transposeArray (array) {
  return array.map(transpose);
}

function transpose (state) {
  const transposedState = {};

  Object.keys(state).forEach(key => {
    const value = state[key];
    let newValue = value;

    if (Array.isArray(value)) {
      newValue = transposeArray(value);
    } else if (key.endsWith('$')) {
      value.take(1).subscribe((current) => {
        transposedState[key.replace('$', '')] = current;
      });
    }

    transposedState[key] = newValue;
  });

  return transposedState;
}

function view (state$) {
  return state$.map(todosView);
}

function todosView ({todos, text}) {
  return (
    div('.todos', [
      input('.new-todo-text', {key: '0', type: 'text', value: text}),
      button('.new-todo', 'Add todo'),
      button('.clear-complete', 'Clear complete'),

      todos.map(todo => todo.DOM)
    ])
  );
}

function todoView ({text, checked}) {
  return (
    div('.todo', [
      input('.checked', {type: 'checkbox', checked}),
      div(text)
    ])
  );
}

function Todo ({DOM, props}) {
  const toggled$ = DOM
    .select('.checked')
    .events('change')
    .map(ev => ev.target.checked)
    .map(checked => ({checked}));

  const state$ = props.merge(toggled$)
    .startWith({})
    .scan((state, change) => Object.assign({}, state, change))
    .shareReplay(1);

  return {
    DOM: state$.map(todoView),

    state$
  };
}

function makeTodo (text, DOM) {
  return isolate(Todo)({DOM, props: Observable.just({text, checked: false})});
}

const action = {
  addTodo (DOM) {
    return function (state) {
      return {
        ...state,

        todos: [...state.todos, makeTodo(state.text, DOM)]
      };
    };
  },

  updateText (text) {
    return function (state) {
      return {
        ...state,

        text
      };
    };
  },

  clearComplete () {
    return function (state) {
      return {
        ...state,

        todos: state.todos.filter(todos => !todos.state.checked)
      };
    };
  }
};

function intent ({DOM}) {
  const newTodo$ = DOM
    .select('.new-todo')
    .events('click');

  const newTodoText$ = DOM
    .select('.new-todo-text')
    .events('change')
    .map(ev => ev.target.value);

  const clearComplete$ = DOM
    .select('.clear-complete')
    .events('click');

  return {
    newTodo$,
    newTodoText$,
    clearComplete$,
    DOM
  };
}

function actions ({newTodo$, newTodoText$, clearComplete$, DOM}) {
  const addTodo$ = newTodo$
    .map(() => action.addTodo(DOM));

  const updateText$ = newTodoText$
    .map((text) => action.updateText(text));

  const removeComplete$ = clearComplete$
    .map(() => action.clearComplete());

  const action$ = Observable.merge(
    addTodo$,
    updateText$,
    removeComplete$
  );

  return action$;
}

function model (action$) {
  const initialState = {
    text: '',
    todos: []
  };

  const state$ = action$
    .startWith(initialState)
    .scan((state, action) => action(transpose(state)));

  return state$;
}

export default function TodoList ({DOM}) {
  return {
    DOM: view(model(actions(intent({DOM}))))
  };
}

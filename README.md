
# KayaJS

**KayaJS** is a lightweight, functional, JSX-like UI framework built with native JavaScript for fast and reactive web interfaces. It is designed for simplicity, performance, and component-based architecture—ideal for building scalable frontend applications without relying on large libraries.

## ✨ Features

- ⚡ **Ultra-Lightweight**: No external dependencies, built on native JavaScript.
- 🧠 **Functional Design**: No class-based components, just simple functions and templates.
- 🔁 **Reactive State**: Easily update and render UI on state change.
- 🔗 **Declarative Event Binding**: Use `@event` syntax for intuitive event handling.
- 🔄 **Component Imports**: Modular architecture using `{{ import './component.ky' with { data } }}` syntax.
- 🧩 **Logic Blocks**: Define local functions and state using `<useLogic>` blocks in each `.ky` file.

## 📦 Installation

```bash
npm install kayajs
```

## 🚀 Quick Start

```html
<!-- index.html -->
<div id="root"></div>
<script type="module" src="app.js"></script>
```

```javascript
// app.js
import { renderKy } from 'kayajs';

renderKy('app.ky', {}).then(html => {
  document.getElementById('root').innerHTML = html;
});
```

```ky
<!-- app.ky -->
<useLogic>
  let count = 0;
  const increment = () => {
    count++;
    return { count };
  }
</useLogic>

<button @click="increment">Clicked {{ count }} times</button>
```

## 🧠 Template Syntax

- `{{ variable }}` for injecting values
- `<useLogic>` block for defining state and functions
- `@click`, `@input`, etc., for event bindings
- `{{ import './component.ky' with { key: value } }}` to include components

## 📁 Project Structure

```
my-kaya-app/
├── index.html
├── app.js
├── components/
│   └── MyComponent.ky
├── app.ky
└── node_modules/
```

## 📘 Documentation

Coming soon...

## 🛠️ Roadmap

- [x] Functional component rendering
- [x] Local logic blocks
- [x] Dynamic imports
- [x] Event binding with `@event`
- [ ] Routing system
- [ ] Build tool for `.ky` to `.js`
- [ ] Dev server and CLI

## 🤝 Contributing

Contributions are welcome! Please open issues or submit pull requests.

## 📄 License

MIT License

---

Built with ❤️ by Sachin Sharma - Indian developers for a better frontend future.

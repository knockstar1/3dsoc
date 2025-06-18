# 3D Social Media Platform

A simple 3D social media platform built with Vite and Three.js, featuring character creation and a unique 3D scrolling interface.

## Features

- Character Creation: Customize your character with different parts (head, teeth, shirt, belt, pants, shoes)
- 3D Home Page: View your character in a 3D diorama with infinite vertical scrolling
- Messages: (Placeholder for future implementation)
- Notifications: (Placeholder for future implementation)

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to the URL shown in the terminal (usually http://localhost:5173)

## Usage

- Use the menu in the top-right corner to navigate between pages
- In Character Creation:
  - Use left/right arrows to cycle through different character parts
  - Each part has unique variations made from simple Three.js shapes
- In Home Page:
  - Scroll up/down to view different dioramas
  - Your character will be displayed in each diorama
  - The background remains black while dioramas scroll independently

## Technologies Used

- Vite
- Three.js
- Tween.js

## Project Structure

```
3d-social/
├── src/
│   ├── pages/
│   │   ├── CharacterCreator.js
│   │   ├── Home.js
│   │   ├── Messages.js
│   │   └── Notifications.js
│   ├── styles/
│   │   └── main.css
│   └── main.js
├── index.html
└── package.json
``` 
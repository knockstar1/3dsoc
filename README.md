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

# 3D Social Project

This is a Node.js, Express, and MongoDB project for a 3D social application.

## Deployment Instructions

This project can be deployed to [Render.com](https://render.com) for the Node.js backend and [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) for the database.

### MongoDB Atlas Setup
1.  **Create a MongoDB Atlas Account**: If you don't have one, sign up for a free account.
2.  **Create a New Cluster**: Follow the instructions to create a new free tier (M0) cluster.
3.  **Create a Database User**: Create a new database user with a strong password. Remember this password, as it will be part of your connection string.
4.  **Configure Network Access**: In the Network Access tab, add your current IP address or allow access from anywhere (0.0.0.0/0) for easier deployment. For production, consider restricting access to specific IP addresses (e.g., Render's IP ranges).
5.  **Get Connection String**: Go to your cluster, click "Connect", choose "Connect your application", and copy the connection string. It will look something like this:
    `mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
    Replace `<username>` and `<password>` with your database user credentials.

### Render Deployment
1.  **Create a Render Account**: Sign up for a free Render account.
2.  **New Web Service**: From your Render dashboard, click "New" -> "Web Service".
3.  **Connect to GitHub**: Connect your GitHub repository where this project is hosted.
4.  **Configure Build & Start Commands**:
    *   **Build Command**: `npm install`
    *   **Start Command**: `npm start` (This uses the `start` script we added to `package.json`)
5.  **Environment Variables**: Add your `MONGODB_URI` as an environment variable in Render. The key should be `MONGODB_URI` and the value should be your MongoDB Atlas connection string (e.g., `mongodb+srv://knockstar:Getmoney27.@cluster0.cjzve7n.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`).
6.  **Deploy**: Click "Create Web Service". Render will automatically build and deploy your application.
7.  **Live Demo Link**: Once deployed, Render will provide a public URL for your application. Update this `README.md` with that link.

### Vercel (Optional - for Frontend Only)
If you choose to host your static frontend on Vercel and your backend on Render with a separate API URL:
1.  **Create a Vercel Account**: Sign up for a free Vercel account.
2.  **New Project**: From your Vercel dashboard, click "New Project".
3.  **Import Git Repository**: Connect your GitHub repository.
4.  **Configure Build & Output Settings**: Vercel should automatically detect your Vite project.
5.  **Environment Variables**: If your frontend needs to know the backend API URL, you'll need to set it as an environment variable in Vercel (e.g., `VITE_API_URL` pointing to your Render backend URL).
6.  **Deploy**: Click "Deploy". Vercel will build and deploy your static frontend.
7.  **Update Frontend**: Modify your frontend's `main.js` (or similar) to fetch data from your Render backend API URL instead of a relative path or `localhost`. 
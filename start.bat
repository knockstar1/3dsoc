@echo off
echo Starting 3D Social Application...

:: Start the server in a new window
start cmd /k "cd server && node server.js"

:: Start the frontend in this window
npm start

echo Both frontend and backend started! 
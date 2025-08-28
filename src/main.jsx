import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Importa estilos base de Carbon una sola vez
import '@carbon/styles/css/styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div id='main'>
    <App />
    </div>
  </React.StrictMode>,
)
// This file is the entry point for the React application, rendering the main App component into the root element.
// It also imports the base styles from Carbon Design System to ensure consistent styling across the application.
// The use of React.StrictMode helps identify potential problems in the application during development.
// The application is structured to visualize sorting algorithms, providing an interactive experience for users.
// The main.jsx file is essential for bootstrapping the React application and integrating it with the HTML document.
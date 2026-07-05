import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Background from './Background'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Background />
    <App />
  </React.StrictMode>
)
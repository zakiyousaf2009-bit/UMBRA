import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import { installNetworkGuard } from './privacy/networkGuard.js'

installNetworkGuard()
createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)

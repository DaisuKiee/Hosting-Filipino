import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { FaPlus, FaPlay, FaStop, FaTrash, FaCog, FaRobot } from 'react-icons/fa';
import Toast from '../components/Toast';
import '../components/Toast.css';
import './Dashboard.css';

function Dashboard() {
  const [bots, setBots] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newBot, setNewBot] = useState({ name: '', description: '', mainFile: 'index.js' });
  const [toasts, setToasts] = useState([]);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Toast notification system
  const showToast = (message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    const newToast = { id, message, type, duration };
    setToasts(prev => [...prev, newToast]);
    return id;
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  useEffect(() => {
    fetchBots();
  }, []);

  const fetchBots = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/bots');
      setBots(response.data);
    } catch (error) {
      console.error('Error fetching bots:', error);
    }
  };

  const createBot = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/bots', newBot);
      setShowModal(false);
      setNewBot({ name: '', description: '', mainFile: 'index.js' });
      fetchBots();
      showToast(`Bot "${newBot.name}" created successfully`, 'success');
    } catch (error) {
      console.error('Error creating bot:', error);
      showToast(`Failed to create bot: ${error.response?.data?.error || error.message}`, 'error');
    }
  };

  const startBot = async (id) => {
    try {
      await axios.post(`http://localhost:5000/api/bots/${id}/start`);
      fetchBots();
      showToast('Bot started successfully', 'success');
    } catch (error) {
      console.error('Error starting bot:', error);
      showToast(`Failed to start bot: ${error.response?.data?.error || error.message}`, 'error');
    }
  };

  const stopBot = async (id) => {
    try {
      await axios.post(`http://localhost:5000/api/bots/${id}/stop`);
      fetchBots();
      showToast('Bot stopped successfully', 'success');
    } catch (error) {
      console.error('Error stopping bot:', error);
      showToast(`Failed to stop bot: ${error.response?.data?.error || error.message}`, 'error');
    }
  };

  const deleteBot = async (id, botName) => {
    // Show confirmation toast
    const confirmed = await new Promise((resolve) => {
      const toastId = showToast(
        <div>
          <div style={{ marginBottom: '8px' }}>Delete bot "{botName}"?</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => { removeToast(toastId); resolve(true); }}
              style={{
                background: '#ed4245',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Delete
            </button>
            <button 
              onClick={() => { removeToast(toastId); resolve(false); }}
              style={{
                background: '#3e3e42',
                color: '#d4d4d4',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Cancel
            </button>
          </div>
        </div>,
        'warning',
        0 // Don't auto-close
      );
    });

    if (!confirmed) return;

    try {
      await axios.delete(`http://localhost:5000/api/bots/${id}`);
      fetchBots();
      showToast(`Bot "${botName}" deleted successfully`, 'success');
    } catch (error) {
      console.error('Error deleting bot:', error);
      showToast(`Failed to delete bot: ${error.response?.data?.error || error.message}`, 'error');
    }
  };

  return (
    <div className="dashboard">
      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>

      <nav className="navbar">
        <h1><FaRobot /> Discord Bot Panel</h1>
        <div className="nav-right">
          <span>Welcome, {user?.username}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </nav>

      <div className="dashboard-content">
        <div className="header">
          <h2>Your Bots</h2>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <FaPlus /> Create Bot
          </button>
        </div>

        <div className="bots-grid">
          {bots.map((bot) => (
            <div key={bot._id} className="bot-card">
              <div className="bot-header">
                <h3>{bot.name}</h3>
                <span className={`status ${bot.status}`}>{bot.status}</span>
              </div>
              <p>{bot.description || 'No description'}</p>
              <div className="bot-info">
                <small>Main: {bot.mainFile}</small>
                <small>Node: v{bot.nodeVersion}</small>
              </div>
              <div className="bot-actions">
                {bot.status === 'running' ? (
                  <button onClick={() => stopBot(bot._id)} className="btn-stop">
                    <FaStop /> Stop
                  </button>
                ) : (
                  <button onClick={() => startBot(bot._id)} className="btn-start">
                    <FaPlay /> Start
                  </button>
                )}
                <button onClick={() => navigate(`/bot/${bot._id}`)} className="btn-manage">
                  <FaCog /> Manage
                </button>
                <button onClick={() => deleteBot(bot._id, bot.name)} className="btn-delete">
                  <FaTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Bot</h2>
            <form onSubmit={createBot}>
              <input
                type="text"
                placeholder="Bot Name"
                value={newBot.name}
                onChange={(e) => setNewBot({ ...newBot, name: e.target.value })}
                required
              />
              <textarea
                placeholder="Description (optional)"
                value={newBot.description}
                onChange={(e) => setNewBot({ ...newBot, description: e.target.value })}
              />
              <input
                type="text"
                placeholder="Main File (e.g., index.js)"
                value={newBot.mainFile}
                onChange={(e) => setNewBot({ ...newBot, mainFile: e.target.value })}
              />
              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;

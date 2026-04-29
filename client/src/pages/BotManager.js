import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import Editor from '@monaco-editor/react';
import { FaArrowLeft, FaPlay, FaStop, FaSync, FaTerminal, FaCode, FaCog, FaPlus, FaUpload, FaFileArchive, FaFile, FaTrash, FaCheckSquare, FaSquare, FaCheck } from 'react-icons/fa';
import FileIcon from '../components/FileIcon';
import Toast from '../components/Toast';
import '../components/Toast.css';
import './BotManager.css';

function BotManager() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bot, setBot] = useState(null);
  const [activeTab, setActiveTab] = useState('console');
  const [logs, setLogs] = useState([]);
  const [fileTree, setFileTree] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState('file'); // 'file' or 'folder'
  const [createName, setCreateName] = useState('');
  const [createParentFolder, setCreateParentFolder] = useState(''); // Track which folder to create in
  const [selectedItems, setSelectedItems] = useState(new Set()); // Track selected items for bulk operations
  const [isSelectionMode, setIsSelectionMode] = useState(false); // Toggle selection mode
  const [loading, setLoading] = useState({
    create: false,
    delete: false,
    bulkDelete: false,
    bulkArchive: false,
    move: false,
    extract: false,
    upload: false,
    fileTree: false,
    updateBot: false
  });
  const [editingMainFile, setEditingMainFile] = useState(false);
  const [newMainFile, setNewMainFile] = useState('');
  const [draggedItem, setDraggedItem] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [isDraggable, setIsDraggable] = useState(false);
  const [holdingItem, setHoldingItem] = useState(null);
  const [autoSaveTimeout, setAutoSaveTimeout] = useState(null);
  const [toasts, setToasts] = useState([]);
  const consoleOutputRef = useRef(null);
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  const holdTimerRef = useRef(null);

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

  // Auto-scroll console to bottom when new logs arrive
  useEffect(() => {
    if (consoleOutputRef.current) {
      consoleOutputRef.current.scrollTop = consoleOutputRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    const fetchBot = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/bots/${id}`);
        setBot(response.data);
      } catch (error) {
        console.error('Error fetching bot:', error);
      }
    };

    const fetchFileTree = async () => {
      try {
        setLoadingState('fileTree', true);
        const response = await axios.get(`http://localhost:5000/api/files/${id}/tree`);
        setFileTree(response.data);
      } catch (error) {
        console.error('Error fetching file tree:', error);
      } finally {
        setLoadingState('fileTree', false);
      }
    };

    fetchBot();
    fetchFileTree();
    
    // Setup WebSocket connection
    const token = localStorage.getItem('token');
    const newSocket = io('http://localhost:5000', {
      auth: { token }
    });
    
    socketRef.current = newSocket;
    
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      newSocket.emit('subscribe-logs', id);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });
    
    newSocket.on('log', (data) => {
      if (data.botId === id) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
          message: data.message,
          timestamp: timestamp,
          id: Date.now() + Math.random()
        };
        setLogs((prev) => [...prev, logEntry]);
      }
    });

    newSocket.on('bot-status-changed', (data) => {
      if (data.botId === id) {
        console.log('Bot status changed:', data.status);
        setBot(prev => prev ? { ...prev, status: data.status } : null);
        
        // Add status change message to logs
        const statusLog = {
          message: `📊 Status changed to: ${data.status.toUpperCase()}${data.message ? ` - ${data.message}` : ''}`,
          timestamp: new Date().toLocaleTimeString(),
          id: Date.now() + Math.random(),
          type: data.status === 'error' ? 'error' : 'warning'
        };
        setLogs((prev) => [...prev, statusLog]);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setIsConnected(false);
    });
    
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('unsubscribe-logs', id);
        socketRef.current.close();
      }
    };
  }, [id]);

  const openFile = async (filePath) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/files/${id}/file`, {
        params: { path: filePath }
      });
      setCurrentFile(filePath);
      setFileContent(response.data.content);
      setActiveTab('files');
    } catch (error) {
      console.error('Error opening file:', error);
    }
  };

  const autoSaveFile = async (content) => {
    if (!currentFile) return;
    try {
      await axios.post(`http://localhost:5000/api/files/${id}/file`, {
        path: currentFile,
        content: content
      });
      // Optionally show a subtle success indicator
      console.log(`Auto-saved: ${currentFile}`);
    } catch (error) {
      console.error('Auto-save error:', error);
      // Show error message in console for auto-save failures
      const errorLog = {
        message: `⚠️ Auto-save failed for: ${currentFile}`,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
        type: 'error'
      };
      setLogs(prev => [...prev, errorLog]);
    }
  };

  const handleFileContentChange = (value) => {
    setFileContent(value || '');
    
    // Clear existing timeout
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }
    
    // Set new timeout for auto-save (debounced)
    const newTimeout = setTimeout(() => {
      autoSaveFile(value || '');
    }, 1000); // Auto-save after 1 second of inactivity
    
    setAutoSaveTimeout(newTimeout);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
    };
  }, [autoSaveTimeout]);

  const startBot = async () => {
    try {
      await axios.post(`http://localhost:5000/api/bots/${id}/start`);
      setBot(prev => ({ ...prev, status: 'running' }));
      // Clear logs and add start message
      const startLog = {
        message: `🚀 Starting bot: ${bot?.name}`,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
        type: 'info'
      };
      setLogs([startLog]);
    } catch (error) {
      console.error('Error starting bot:', error);
      const errorLog = {
        message: `✗ Failed to start bot: ${error.response?.data?.error || error.message}`,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
        type: 'error'
      };
      setLogs(prev => [...prev, errorLog]);
    }
  };

  const stopBot = async () => {
    try {
      await axios.post(`http://localhost:5000/api/bots/${id}/stop`);
      setBot(prev => ({ ...prev, status: 'stopped' }));
      const stopLog = {
        message: `🛑 Bot stopped: ${bot?.name}`,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
        type: 'warning'
      };
      setLogs(prev => [...prev, stopLog]);
    } catch (error) {
      console.error('Error stopping bot:', error);
    }
  };

  const restartBot = async () => {
    try {
      await axios.post(`http://localhost:5000/api/bots/${id}/restart`);
      setBot(prev => ({ ...prev, status: 'running' }));
      const restartLog = {
        message: `🔄 Restarting bot: ${bot?.name}`,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
        type: 'info'
      };
      setLogs([restartLog]);
    } catch (error) {
      console.error('Error restarting bot:', error);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    const clearLog = {
      message: '🧹 Console cleared',
      timestamp: new Date().toLocaleTimeString(),
      id: Date.now(),
      type: 'info'
    };
    setLogs([clearLog]);
  };

  const handleFileUpload = async () => {
    if (selectedFiles.length === 0) return;
    
    setUploading(true);
    const formData = new FormData();
    
    Array.from(selectedFiles).forEach(file => {
      formData.append('files', file);
    });
    
    try {
      const response = await axios.post(`http://localhost:5000/api/files/${id}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      const uploadLog = {
        message: `📁 ${response.data.message}`,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
        type: 'success'
      };
      setLogs(prev => [...prev, uploadLog]);
      
      // Refresh file tree
      const treeResponse = await axios.get(`http://localhost:5000/api/files/${id}/tree`);
      setFileTree(treeResponse.data);
      
      setShowUploadModal(false);
      setSelectedFiles([]);
    } catch (error) {
      console.error('Upload error:', error);
      const errorLog = {
        message: `❌ Upload failed: ${error.response?.data?.error || error.message}`,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
        type: 'error'
      };
      setLogs(prev => [...prev, errorLog]);
    } finally {
      setUploading(false);
    }
  };

  const extractArchive = async (archivePath) => {
    setLoadingState('extract', true);
    
    try {
      const response = await axios.post(`http://localhost:5000/api/files/${id}/extract`, {
        archivePath,
        deleteAfterExtract: true
      });
      
      showToast(`Archive extracted successfully`, 'success');
      
      const extractLog = {
        message: `📦 ${response.data.message} (${response.data.archiveType})`,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
        type: 'success'
      };
      setLogs(prev => [...prev, extractLog]);
      
      // Refresh file tree
      const treeResponse = await axios.get(`http://localhost:5000/api/files/${id}/tree`);
      setFileTree(treeResponse.data);
      
    } catch (error) {
      console.error('Extract error:', error);
      showToast(`Extraction failed: ${error.response?.data?.error || error.message}`, 'error');
      
      const errorLog = {
        message: `❌ Extraction failed: ${error.response?.data?.error || error.message}`,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
        type: 'error'
      };
      setLogs(prev => [...prev, errorLog]);
    } finally {
      setLoadingState('extract', false);
    }
  };

  const isArchiveFile = (filename) => {
    const archiveExtensions = ['.zip', '.tar', '.tar.gz', '.tgz', '.tar.bz2', '.rar', '.7z'];
    return archiveExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  };

  const setLoadingState = (operation, isLoading) => {
    setLoading(prev => ({ ...prev, [operation]: isLoading }));
  };

  const handleCreateItem = async () => {
    if (!createName.trim()) return;
    
    setLoadingState('create', true);
    
    try {
      // Construct the full path including parent folder
      const fullPath = createParentFolder 
        ? `${createParentFolder}/${createName.trim()}`
        : createName.trim();
      
      const response = await axios.post(`http://localhost:5000/api/files/${id}/create`, {
        path: fullPath,
        type: createType
      });
      
      showToast(`Created ${createType}: ${createName.trim()}`, 'success');
      
      const createLog = {
        message: `📁 ${response.data.message}`,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
        type: 'success'
      };
      setLogs(prev => [...prev, createLog]);
      
      // Refresh file tree
      setLoadingState('fileTree', true);
      const treeResponse = await axios.get(`http://localhost:5000/api/files/${id}/tree`);
      setFileTree(treeResponse.data);
      setLoadingState('fileTree', false);
      
      // Auto-expand the parent folder if creating inside one
      if (createParentFolder) {
        setExpandedFolders(prev => new Set([...prev, createParentFolder]));
      }
      
      setShowCreateModal(false);
      setCreateName('');
      setCreateType('file');
      setCreateParentFolder('');
    } catch (error) {
      console.error('Create error:', error);
      showToast(`Failed to create ${createType}: ${error.response?.data?.error || error.message}`, 'error');
      
      const errorLog = {
        message: `❌ Failed to create ${createType}: ${error.response?.data?.error || error.message}`,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
        type: 'error'
      };
      setLogs(prev => [...prev, errorLog]);
    } finally {
      setLoadingState('create', false);
    }
  };

  const handleDeleteItem = async (item) => {
    // Confirm deletion with toast
    const itemType = item.type === 'folder' ? 'folder' : 'file';
    const confirmMessage = item.type === 'folder' 
      ? `Delete the folder "${item.name}" and all its contents?`
      : `Delete "${item.name}"?`;
    
    // Show confirmation toast
    const confirmed = await new Promise((resolve) => {
      const toastId = showToast(
        <div>
          <div style={{ marginBottom: '8px' }}>{confirmMessage}</div>
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

    setLoadingState('delete', true);

    try {
      await axios.delete(`http://localhost:5000/api/files/${id}/file`, {
        params: { path: item.path }
      });

      showToast(`Deleted ${itemType}: ${item.name}`, 'success');

      const deleteLog = {
        message: `🗑️ Deleted ${itemType}: ${item.name}`,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
        type: 'warning'
      };
      setLogs(prev => [...prev, deleteLog]);

      // Refresh file tree
      setLoadingState('fileTree', true);
      const treeResponse = await axios.get(`http://localhost:5000/api/files/${id}/tree`);
      setFileTree(treeResponse.data);
      setLoadingState('fileTree', false);

      // If the deleted file was open, close it
      if (currentFile === item.path) {
        setCurrentFile(null);
        setFileContent('');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showToast(`Failed to delete ${itemType}: ${error.response?.data?.error || error.message}`, 'error');
      
      const errorLog = {
        message: `❌ Failed to delete ${itemType}: ${error.response?.data?.error || error.message}`,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
        type: 'error'
      };
      setLogs(prev => [...prev, errorLog]);
    } finally {
      setLoadingState('delete', false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;

    const itemCount = selectedItems.size;
    const confirmMessage = `Delete ${itemCount} selected item${itemCount > 1 ? 's' : ''}? This cannot be undone.`;
    
    // Show confirmation toast
    const confirmed = await new Promise((resolve) => {
      const toastId = showToast(
        <div>
          <div style={{ marginBottom: '8px' }}>{confirmMessage}</div>
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
              Delete All
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

    setLoadingState('bulkDelete', true);

    let successCount = 0;
    let errorCount = 0;

    // Delete items one by one
    for (const itemPath of selectedItems) {
      try {
        await axios.delete(`http://localhost:5000/api/files/${id}/file`, {
          params: { path: itemPath }
        });
        successCount++;
      } catch (error) {
        console.error('Bulk delete error:', error);
        errorCount++;
      }
    }

    // Show results
    if (successCount > 0) {
      showToast(`Successfully deleted ${successCount} item${successCount > 1 ? 's' : ''}`, 'success');
      
      const successLog = {
        message: `🗑️ Bulk delete: ${successCount} item${successCount > 1 ? 's' : ''} deleted successfully`,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
        type: 'success'
      };
      setLogs(prev => [...prev, successLog]);
    }

    if (errorCount > 0) {
      showToast(`Failed to delete ${errorCount} item${errorCount > 1 ? 's' : ''}`, 'error');
      
      const errorLog = {
        message: `❌ Bulk delete: ${errorCount} item${errorCount > 1 ? 's' : ''} failed to delete`,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
        type: 'error'
      };
      setLogs(prev => [...prev, errorLog]);
    }

    // Clear selection and refresh
    setSelectedItems(new Set());
    setIsSelectionMode(false);

    // Refresh file tree
    setLoadingState('fileTree', true);
    const treeResponse = await axios.get(`http://localhost:5000/api/files/${id}/tree`);
    setFileTree(treeResponse.data);
    setLoadingState('fileTree', false);

    // Close file if it was deleted
    if (selectedItems.has(currentFile)) {
      setCurrentFile(null);
      setFileContent('');
    }

    setLoadingState('bulkDelete', false);
  };

  const handleBulkArchive = async () => {
    if (selectedItems.size === 0) return;

    const itemCount = selectedItems.size;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const archiveName = `archive-${timestamp}.zip`;

    setLoadingState('bulkArchive', true);

    try {
      await axios.post(`http://localhost:5000/api/files/${id}/archive`, {
        items: Array.from(selectedItems),
        archiveName: archiveName
      });

      showToast(`Created archive: ${archiveName}`, 'success');

      const successLog = {
        message: `📦 Created archive: ${archiveName} (${itemCount} item${itemCount > 1 ? 's' : ''})`,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
        type: 'success'
      };
      setLogs(prev => [...prev, successLog]);

      // Clear selection and refresh
      setSelectedItems(new Set());
      setIsSelectionMode(false);

      // Refresh file tree
      setLoadingState('fileTree', true);
      const treeResponse = await axios.get(`http://localhost:5000/api/files/${id}/tree`);
      setFileTree(treeResponse.data);
      setLoadingState('fileTree', false);

    } catch (error) {
      console.error('Bulk archive error:', error);
      showToast(`Archive failed: ${error.response?.data?.error || error.message}`, 'error');
      
      const errorLog = {
        message: `❌ Archive failed: ${error.response?.data?.error || error.message}`,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
        type: 'error'
      };
      setLogs(prev => [...prev, errorLog]);
    } finally {
      setLoadingState('bulkArchive', false);
    }
  };

  const toggleItemSelection = (item) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(item.path)) {
      newSelected.delete(item.path);
    } else {
      newSelected.add(item.path);
    }
    setSelectedItems(newSelected);
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedItems(new Set()); // Clear selection when exiting selection mode
    }
  };

  const selectAll = () => {
    const getAllVisiblePaths = (items) => {
      let paths = [];
      items.forEach(item => {
        paths.push(item.path);
        // Don't automatically include children - only top-level items
      });
      return paths;
    };
    
    const allPaths = getAllVisiblePaths(fileTree);
    setSelectedItems(new Set(allPaths));
  };

  const handleUpdateMainFile = async () => {
    if (!newMainFile.trim()) return;
    
    setLoadingState('updateBot', true);
    
    try {
      await axios.patch(`http://localhost:5000/api/bots/${id}`, {
        mainFile: newMainFile.trim()
      });
      
      setBot(prev => ({ ...prev, mainFile: newMainFile.trim() }));
      setEditingMainFile(false);
      
      const updateLog = {
        message: `⚙️ Main file updated to: ${newMainFile.trim()}`,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
        type: 'success'
      };
      setLogs(prev => [...prev, updateLog]);
      
    } catch (error) {
      console.error('Update main file error:', error);
      const errorLog = {
        message: `❌ Failed to update main file: ${error.response?.data?.error || error.message}`,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
        type: 'error'
      };
      setLogs(prev => [...prev, errorLog]);
    } finally {
      setLoadingState('updateBot', false);
    }
  };

  const startEditingMainFile = () => {
    setNewMainFile(bot.mainFile || 'index.js');
    setEditingMainFile(true);
  };

  const cancelEditingMainFile = () => {
    setEditingMainFile(false);
    setNewMainFile('');
  };

  const toggleFolder = (path) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const handleMouseDown = (e, item) => {
    if (item.type === 'folder') return; // Don't enable drag for folders
    
    // Don't prevent default - let the browser handle drag
    setHoldingItem(item);
    
    // Start a timer - after 500ms, enable dragging
    holdTimerRef.current = setTimeout(() => {
      setIsDraggable(true);
      setHoldingItem(null);
    }, 500); // Hold for 500ms to start dragging
  };

  const handleMouseUp = (e, item) => {
    // Clear the hold timer
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    // If we were holding but didn't start dragging, treat it as a click
    if (holdingItem && !isDraggable && !draggedItem) {
      openFile(item.path);
    }

    // Reset states after a short delay to allow drag to complete
    setTimeout(() => {
      setHoldingItem(null);
      if (!draggedItem) {
        setIsDraggable(false);
      }
    }, 50);
  };

  const handleMouseLeave = () => {
    // Cancel hold if mouse leaves the item while holding
    if (holdTimerRef.current && !draggedItem) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
      setHoldingItem(null);
      setIsDraggable(false);
    }
  };

  const handleDragStart = (e, item) => {
    if (!isDraggable) {
      e.preventDefault();
      return;
    }
    
    e.stopPropagation();
    setDraggedItem(item);
    setHoldingItem(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.path);
  };

  const handleDragOver = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    if (item.type === 'folder' && draggedItem && draggedItem.path !== item.path) {
      e.dataTransfer.dropEffect = 'move';
      setDropTarget(item.path);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
  };

  const handleDrop = async (e, targetFolder) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);

    if (!draggedItem || draggedItem.path === targetFolder.path) {
      setDraggedItem(null);
      setIsDraggable(false);
      return;
    }

    setLoadingState('move', true);

    try {
      const response = await axios.post(`http://localhost:5000/api/files/${id}/move`, {
        sourcePath: draggedItem.path,
        destinationFolder: targetFolder.path
      });

      const moveLog = {
        message: `📦 ${response.data.message}`,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
        type: 'success'
      };
      setLogs(prev => [...prev, moveLog]);

      // Refresh file tree
      const treeResponse = await axios.get(`http://localhost:5000/api/files/${id}/tree`);
      setFileTree(treeResponse.data);

      // If the moved file was open, update its path
      if (currentFile === draggedItem.path) {
        const fileName = draggedItem.name;
        const newPath = targetFolder.path ? `${targetFolder.path}/${fileName}` : fileName;
        setCurrentFile(newPath);
      }
    } catch (error) {
      console.error('Move error:', error);
      const errorLog = {
        message: `❌ Move failed: ${error.response?.data?.error || error.message}`,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
        type: 'error'
      };
      setLogs(prev => [...prev, errorLog]);
    } finally {
      setDraggedItem(null);
      setIsDraggable(false);
      setLoadingState('move', false);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDropTarget(null);
    setIsDraggable(false);
    setHoldingItem(null);
  };

  const renderFileTree = (items, level = 0) => {
    return items.map((item) => (
      <div key={item.path} style={{ marginLeft: `${level * 15}px` }}>
        {item.type === 'folder' ? (
          <>
            <div 
              className={`file-item folder ${dropTarget === item.path ? 'drop-target' : ''} ${selectedItems.has(item.path) ? 'selected' : ''}`}
              onClick={(e) => {
                if (isSelectionMode) {
                  e.stopPropagation();
                  toggleItemSelection(item);
                } else {
                  toggleFolder(item.path);
                }
              }}
              onDragOver={(e) => handleDragOver(e, item)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, item)}
              draggable={false}
            >
              {isSelectionMode && (
                <div className="selection-checkbox">
                  {selectedItems.has(item.path) ? <FaCheckSquare /> : <FaSquare />}
                </div>
              )}
              <FileIcon 
                name={item.name} 
                type="folder" 
                isOpen={expandedFolders.has(item.path)}
                size={16}
              />
              <span className="file-name">{item.name}</span>
              {!isSelectionMode && (
                <div className="file-actions">
                  <button 
                    className="folder-add-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCreateParentFolder(item.path);
                      setShowCreateModal(true);
                    }}
                    title="Create file or folder inside"
                  >
                    <FaPlus />
                  </button>
                  <button 
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteItem(item);
                    }}
                    title="Delete folder"
                  >
                    <FaTrash />
                  </button>
                </div>
              )}
            </div>
            {expandedFolders.has(item.path) && item.children && (
              <div>{renderFileTree(item.children, level + 1)}</div>
            )}
          </>
        ) : (
          <div 
            className={`file-item file ${draggedItem?.path === item.path ? 'dragging' : ''} ${holdingItem?.path === item.path ? 'holding' : ''} ${selectedItems.has(item.path) ? 'selected' : ''}`}
            onMouseDown={(e) => {
              if (!isSelectionMode) {
                handleMouseDown(e, item);
              }
            }}
            onMouseUp={(e) => {
              if (isSelectionMode) {
                toggleItemSelection(item);
              } else {
                handleMouseUp(e, item);
              }
            }}
            onMouseLeave={handleMouseLeave}
            draggable={isDraggable && holdingItem?.path !== item.path && !isSelectionMode}
            onDragStart={(e) => handleDragStart(e, item)}
            onDragEnd={handleDragEnd}
          >
            {isSelectionMode && (
              <div className="selection-checkbox">
                {selectedItems.has(item.path) ? <FaCheckSquare /> : <FaSquare />}
              </div>
            )}
            <FileIcon name={item.name} type="file" size={16} />
            <span className="file-name">{item.name}</span>
            {!isSelectionMode && (
              <div className="file-actions">
                {isArchiveFile(item.name) && (
                  <button 
                    className={`extract-btn ${loading.extract ? 'loading' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      extractArchive(item.path);
                    }}
                    disabled={loading.extract}
                    title={loading.extract ? "Extracting..." : "Extract archive"}
                  >
                    <FaFileArchive />
                  </button>
                )}
                <button 
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteItem(item);
                  }}
                  title="Delete file"
                >
                  <FaTrash />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    ));
  };

  const getLanguage = (filename) => {
    if (!filename) return 'javascript';
    const ext = filename.split('.').pop().toLowerCase();
    const name = filename.toLowerCase();
    
    // Check for .env files
    if (name === '.env' || name.startsWith('.env.') || name === '.env.example') {
      return 'shell'; // Use shell/bash syntax for .env files
    }
    
    const langMap = {
      js: 'javascript',
      json: 'json',
      ts: 'typescript',
      py: 'python',
      html: 'html',
      css: 'css',
      scss: 'scss',
      sass: 'sass',
      less: 'less',
      md: 'markdown',
      txt: 'plaintext',
      yml: 'yaml',
      yaml: 'yaml',
      xml: 'xml',
      sh: 'shell',
      bash: 'shell',
      env: 'shell'
    };
    return langMap[ext] || 'plaintext';
  };

  const handleEditorWillMount = (monaco) => {
    // Disable validation for shell/bash (used for .env files)
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true
    });
    
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true
    });
  };

  if (!bot) return <div className="loading">Loading...</div>;

  return (
    <div className="bot-manager">
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

      <div className="manager-header">
        <div className="header-left">
          <button onClick={() => navigate('/')} className="btn-back">
            <FaArrowLeft /> Back
          </button>
          <h2>{bot.name}</h2>
          <span className={`status ${bot.status}`}>{bot.status}</span>
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            {isConnected ? 'Live' : 'Disconnected'}
          </div>
        </div>
        <div className="header-actions">
          {bot.status === 'running' ? (
            <button onClick={stopBot} className="btn-stop">
              <FaStop /> Stop
            </button>
          ) : (
            <button onClick={startBot} className="btn-start">
              <FaPlay /> Start
            </button>
          )}
          <button onClick={restartBot} className="btn-restart">
            <FaSync /> Restart
          </button>
        </div>
      </div>

      <div className="manager-content">
        <div className="sidebar">
          <div className="sidebar-header">
            <h3>
              <FileIcon name="folder" type="folder" size={16} />
              Files
              {loading.fileTree && <div className="inline-spinner"></div>}
            </h3>
            <div className="sidebar-actions">
              <button 
                className="btn-upload" 
                onClick={() => setShowUploadModal(true)}
                title="Upload files"
              >
                <FaUpload />
              </button>
              <button 
                className="btn-add-file" 
                onClick={() => setShowCreateModal(true)}
                title="Create new file or folder"
              >
                <FaPlus />
              </button>
              <button 
                className={`btn-select ${isSelectionMode ? 'active' : ''}`}
                onClick={toggleSelectionMode}
                title={isSelectionMode ? "Exit selection mode" : "Select multiple items"}
              >
                {isSelectionMode ? <FaCheck /> : <FaCheckSquare />}
              </button>
            </div>
          </div>
          
          {isSelectionMode && (
            <div className="bulk-actions">
              <div className="selection-info">
                {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
              </div>
              <div className="bulk-buttons">
                <button 
                  className="btn-select-all"
                  onClick={selectAll}
                  title="Select all items"
                >
                  Select All
                </button>
                <button 
                  className="btn-bulk-archive"
                  onClick={handleBulkArchive}
                  disabled={selectedItems.size === 0 || loading.bulkArchive}
                  title="Archive selected items to ZIP"
                >
                  <FaFileArchive /> {loading.bulkArchive ? 'Archiving...' : `Archive (${selectedItems.size})`}
                </button>
                <button 
                  className="btn-bulk-delete"
                  onClick={handleBulkDelete}
                  disabled={selectedItems.size === 0 || loading.bulkDelete}
                  title="Delete selected items"
                >
                  <FaTrash /> {loading.bulkDelete ? 'Deleting...' : `Delete (${selectedItems.size})`}
                </button>
              </div>
            </div>
          )}
          <div className="file-tree">
            <div 
              className={`file-tree-root ${dropTarget === '' ? 'drop-target-root' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedItem) {
                  e.dataTransfer.dropEffect = 'move';
                  setDropTarget('');
                }
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                if (e.currentTarget === e.target) {
                  setDropTarget(null);
                }
              }}
              onDrop={async (e) => {
                e.preventDefault();
                setDropTarget(null);

                if (!draggedItem) return;

                // Check if already at root
                if (!draggedItem.path.includes('/') && !draggedItem.path.includes('\\')) {
                  return;
                }

                try {
                  const response = await axios.post(`http://localhost:5000/api/files/${id}/move`, {
                    sourcePath: draggedItem.path,
                    destinationFolder: ''
                  });

                  const moveLog = {
                    message: `📦 ${response.data.message}`,
                    timestamp: new Date().toLocaleTimeString(),
                    id: Date.now(),
                    type: 'success'
                  };
                  setLogs(prev => [...prev, moveLog]);

                  // Refresh file tree
                  const treeResponse = await axios.get(`http://localhost:5000/api/files/${id}/tree`);
                  setFileTree(treeResponse.data);

                  // Update current file path if needed
                  if (currentFile === draggedItem.path) {
                    setCurrentFile(draggedItem.name);
                  }
                } catch (error) {
                  console.error('Move error:', error);
                  const errorLog = {
                    message: `❌ Move failed: ${error.response?.data?.error || error.message}`,
                    timestamp: new Date().toLocaleTimeString(),
                    id: Date.now(),
                    type: 'error'
                  };
                  setLogs(prev => [...prev, errorLog]);
                } finally {
                  setDraggedItem(null);
                }
              }}
            >
              {renderFileTree(fileTree)}
            </div>
          </div>
        </div>

        <div className="main-panel">
          <div className="tabs">
            <button
              className={activeTab === 'console' ? 'active' : ''}
              onClick={() => setActiveTab('console')}
            >
              <FaTerminal /> Console
              {logs.length > 0 && <span className="log-count">{logs.length}</span>}
            </button>
            <button
              className={activeTab === 'files' ? 'active' : ''}
              onClick={() => setActiveTab('files')}
            >
              <FaCode /> File Editor
            </button>
            <button
              className={activeTab === 'startup' ? 'active' : ''}
              onClick={() => setActiveTab('startup')}
            >
              <FaCog /> Startup
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'console' && (
              <div className="console">
                <div className="console-header">
                  <span><FaTerminal /> Console Output</span>
                  <div className="console-actions">
                    <span className="log-info">{logs.length} lines</span>
                    <button onClick={clearLogs} className="btn-clear">
                      <FaTrash /> Clear
                    </button>
                  </div>
                </div>
                <div className="console-output" ref={consoleOutputRef}>
                  {logs.length === 0 ? (
                    <div className="console-empty">
                      <FaTerminal size={32} />
                      <p>Console is empty. Start your bot to see logs.</p>
                    </div>
                  ) : (
                    logs.map((log) => (
                      <div key={log.id} className={`log-line ${log.type || ''}`}>
                        <span className="log-timestamp">[{log.timestamp}]</span>
                        <span className="log-message">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'files' && (
              <div className="editor-container">
                {currentFile ? (
                  <>
                    <div className="editor-header">
                      <span>
                        <FileIcon name={currentFile} type="file" size={16} />
                        {currentFile}
                      </span>
                      <div className="auto-save-indicator">
                        Auto-save enabled
                      </div>
                    </div>
                    <Editor
                      height="calc(100% - 50px)"
                      language={getLanguage(currentFile)}
                      value={fileContent}
                      onChange={handleFileContentChange}
                      beforeMount={handleEditorWillMount}
                      theme="vs-dark"
                      options={{
                        minimap: { enabled: true },
                        fontSize: 14,
                        formatOnPaste: true,
                        formatOnType: true,
                        autoClosingBrackets: 'always',
                        autoClosingQuotes: 'always',
                        suggestOnTriggerCharacters: true,
                        quickSuggestions: true,
                        wordBasedSuggestions: true,
                        tabSize: 2,
                        insertSpaces: true,
                        detectIndentation: true,
                        trimAutoWhitespace: true,
                        renderWhitespace: 'selection',
                        renderLineHighlight: 'all',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        // Disable validation for .env and plain text files
                        validate: getLanguage(currentFile) !== 'shell' && getLanguage(currentFile) !== 'plaintext'
                      }}
                    />
                  </>
                ) : (
                  <div className="no-file">
                    <FileIcon name="code" type="file" size={48} />
                    <p>Select a file from the sidebar to edit</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'startup' && (
              <div className="startup-config">
                <h3><FaCog /> Startup Configuration</h3>
                <div className="config-item">
                  <label>Main File:</label>
                  {editingMainFile ? (
                    <div className="edit-main-file">
                      <input 
                        type="text" 
                        value={newMainFile}
                        onChange={(e) => setNewMainFile(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleUpdateMainFile()}
                        placeholder="e.g., index.js, bot.js, main.js"
                        autoFocus
                      />
                      <div className="edit-actions">
                        <button 
                          onClick={handleUpdateMainFile}
                          className="btn-save-main"
                          disabled={!newMainFile.trim() || loading.updateBot}
                        >
                          {loading.updateBot ? 'Saving...' : 'Save'}
                        </button>
                        <button 
                          onClick={cancelEditingMainFile}
                          className="btn-cancel-main"
                          disabled={loading.updateBot}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="main-file-display">
                      <input type="text" value={bot.mainFile} readOnly />
                      <button 
                        onClick={startEditingMainFile}
                        className="btn-edit-main"
                        title="Edit main file"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
                <div className="config-item">
                  <label>Node Version:</label>
                  <input type="text" value={`v${bot.nodeVersion}`} readOnly />
                </div>
                <div className="config-item">
                  <label>Status:</label>
                  <input type="text" value={bot.status} readOnly />
                </div>
                <p className="info">
                  This bot runs on Node.js v21 with auto-restart enabled.
                  Make sure the main file exists in your project directory.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => {
          setShowCreateModal(false);
          setCreateParentFolder('');
        }}>
          <div className="modal create-modal" onClick={(e) => e.stopPropagation()}>
            <h2>
              <FaPlus /> Create New {createType === 'file' ? 'File' : 'Folder'}
              {createParentFolder && (
                <span className="create-location"> in {createParentFolder}</span>
              )}
            </h2>
            
            <div className="create-type-selector">
              <button 
                className={`type-btn ${createType === 'file' ? 'active' : ''}`}
                onClick={() => setCreateType('file')}
              >
                <FaFile /> File
              </button>
              <button 
                className={`type-btn ${createType === 'folder' ? 'active' : ''}`}
                onClick={() => setCreateType('folder')}
              >
                <FileIcon name="folder" type="folder" size={16} />
                Folder
              </button>
            </div>

            <div className="input-group">
              <label>{createType === 'file' ? 'File' : 'Folder'} Name:</label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={createType === 'file' ? 'e.g., newfile.js' : 'e.g., newfolder'}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateItem()}
                autoFocus
              />
              {createType === 'file' && (
                <small>Include the file extension (e.g., .js, .txt, .md)</small>
              )}
              {createParentFolder && (
                <small className="create-path-info">
                  Will be created at: {createParentFolder}/{createName || '...'}
                </small>
              )}
            </div>
            
            <div className="modal-actions">
              <button onClick={() => {
                setShowCreateModal(false);
                setCreateParentFolder('');
              }}>
                Cancel
              </button>
              <button 
                onClick={handleCreateItem} 
                className="btn-primary"
                disabled={!createName.trim() || loading.create}
              >
                {loading.create ? 'Creating...' : `Create ${createType === 'file' ? 'File' : 'Folder'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal upload-modal" onClick={(e) => e.stopPropagation()}>
            <h2><FaUpload /> Upload Files</h2>
            <div className="upload-area">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => setSelectedFiles(e.target.files)}
                style={{ display: 'none' }}
              />
              <div 
                className="drop-zone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  setSelectedFiles(e.dataTransfer.files);
                }}
              >
                <FaUpload size={48} />
                <p>Click to select files or drag and drop</p>
                <small>Supports: ZIP, TAR, TAR.GZ, RAR, 7Z and all other file types</small>
              </div>
              
              {selectedFiles.length > 0 && (
                <div className="selected-files">
                  <h4>Selected Files ({selectedFiles.length}):</h4>
                  <ul>
                    {Array.from(selectedFiles).map((file, index) => (
                      <li key={index}>
                        <FileIcon name={file.name} type="file" size={16} />
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                        {isArchiveFile(file.name) && <span className="archive-badge">Archive</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="modal-actions">
              <button onClick={() => setShowUploadModal(false)} disabled={uploading}>
                Cancel
              </button>
              <button 
                onClick={handleFileUpload} 
                className="btn-primary"
                disabled={selectedFiles.length === 0 || uploading || loading.upload}
              >
                {uploading || loading.upload ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BotManager;

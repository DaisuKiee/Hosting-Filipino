import React from 'react';
import { 
  FaFolder, 
  FaFolderOpen, 
  FaFile, 
  FaFileCode, 
  FaFileAlt, 
  FaImage, 
  FaFileVideo, 
  FaFileAudio, 
  FaFilePdf, 
  FaFileArchive, 
  FaCog, 
  FaTerminal,
  FaDatabase
} from 'react-icons/fa';

const FileIcon = ({ name, type, isOpen = false, size = 20 }) => {
  const getFileIcon = () => {
    if (type === 'folder') {
      return isOpen ? 
        <FaFolderOpen style={{ color: '#dcb67a' }} /> : 
        <FaFolder style={{ color: '#dcb67a' }} />;
    }

    const extension = name.split('.').pop()?.toLowerCase();
    const fileName = name.toLowerCase();

    // Programming files
    if (['js', 'jsx', 'mjs'].includes(extension)) {
      return <FaFileCode style={{ color: '#f7df1e' }} />;
    }
    if (['ts', 'tsx'].includes(extension)) {
      return <FaFileCode style={{ color: '#3178c6' }} />;
    }
    if (['py', 'pyw'].includes(extension)) {
      return <FaFileCode style={{ color: '#3776ab' }} />;
    }
    if (['java'].includes(extension)) {
      return <FaFileCode style={{ color: '#ed8b00' }} />;
    }
    if (['cpp', 'c', 'h', 'hpp'].includes(extension)) {
      return <FaFileCode style={{ color: '#00599c' }} />;
    }
    if (['cs'].includes(extension)) {
      return <FaFileCode style={{ color: '#239120' }} />;
    }
    if (['php'].includes(extension)) {
      return <FaFileCode style={{ color: '#777bb4' }} />;
    }
    if (['rb'].includes(extension)) {
      return <FaFileCode style={{ color: '#cc342d' }} />;
    }
    if (['go'].includes(extension)) {
      return <FaFileCode style={{ color: '#00add8' }} />;
    }
    if (['rs'].includes(extension)) {
      return <FaFileCode style={{ color: '#dea584' }} />;
    }

    // Web files
    if (['html', 'htm'].includes(extension)) {
      return <FaFileCode style={{ color: '#e34f26' }} />;
    }
    if (['css', 'scss', 'sass', 'less'].includes(extension)) {
      return <FaFileCode style={{ color: '#1572b6' }} />;
    }

    // Data files
    if (['json'].includes(extension)) {
      return <FaFileCode style={{ color: '#ffd700' }} />;
    }
    if (['xml', 'yaml', 'yml'].includes(extension)) {
      return <FaFileCode style={{ color: '#ff6600' }} />;
    }
    if (['sql'].includes(extension)) {
      return <FaDatabase style={{ color: '#336791' }} />;
    }

    // Config files
    if (['env'].includes(extension) || fileName.startsWith('.env')) {
      return <FaCog style={{ color: '#4caf50' }} />;
    }
    if (['config', 'conf', 'ini', 'cfg'].includes(extension)) {
      return <FaCog style={{ color: '#9e9e9e' }} />;
    }
    if (['gitignore', 'gitattributes'].includes(fileName.replace('.', ''))) {
      return <FaCog style={{ color: '#f05032' }} />;
    }

    // Package files
    if (fileName === 'package.json') {
      return <FaFileCode style={{ color: '#cb3837' }} />;
    }
    if (fileName === 'package-lock.json') {
      return <FaFileCode style={{ color: '#8b4513' }} />;
    }
    if (['dockerfile'].includes(fileName) || fileName.startsWith('dockerfile')) {
      return <FaCog style={{ color: '#2496ed' }} />;
    }

    // Documentation
    if (['md', 'markdown'].includes(extension)) {
      return <FaFileAlt style={{ color: '#083fa1' }} />;
    }
    if (['txt', 'log'].includes(extension)) {
      return <FaFileAlt style={{ color: '#9e9e9e' }} />;
    }
    if (['pdf'].includes(extension)) {
      return <FaFilePdf style={{ color: '#ff5722' }} />;
    }

    // Media files
    if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'ico', 'webp'].includes(extension)) {
      return <FaImage style={{ color: '#4caf50' }} />;
    }
    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(extension)) {
      return <FaFileVideo style={{ color: '#f44336' }} />;
    }
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'].includes(extension)) {
      return <FaFileAudio style={{ color: '#9c27b0' }} />;
    }

    // Archives
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(extension) || 
        fileName.includes('.tar.')) {
      return <FaFileArchive style={{ color: '#ff9800' }} />;
    }

    // Shell/Terminal
    if (['sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd'].includes(extension)) {
      return <FaTerminal style={{ color: '#4caf50' }} />;
    }

    // Default file icon
    return <FaFile style={{ color: '#9e9e9e' }} />;
  };

  return (
    <span 
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center',
        fontSize: size,
        width: size,
        height: size
      }}
    >
      {getFileIcon()}
    </span>
  );
};

export default FileIcon;
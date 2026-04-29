const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const AdmZip = require('adm-zip');
const tar = require('tar');
const { extract } = require('node-7z');
const Bot = require('../models/Bot');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const botId = req.params.botId;
    const botDir = path.join(__dirname, '../../bot-data', botId);
    try {
      await fs.mkdir(botDir, { recursive: true });
      cb(null, botDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types
    cb(null, true);
  }
});

// Helper function to detect archive type
function getArchiveType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const fullName = filename.toLowerCase();
  
  if (ext === '.zip') return 'zip';
  if (ext === '.tar') return 'tar';
  if (fullName.endsWith('.tar.gz') || fullName.endsWith('.tgz')) return 'tar.gz';
  if (fullName.endsWith('.tar.bz2')) return 'tar.bz2';
  if (ext === '.rar') return 'rar';
  if (ext === '.7z') return '7z';
  
  return null;
}

// Helper function to extract archives
async function extractArchive(filePath, extractPath, archiveType) {
  try {
    await fs.mkdir(extractPath, { recursive: true });
    
    switch (archiveType) {
      case 'zip':
        const zip = new AdmZip(filePath);
        zip.extractAllTo(extractPath, true);
        break;
        
      case 'tar':
        await tar.x({
          file: filePath,
          cwd: extractPath
        });
        break;
        
      case 'tar.gz':
      case 'tgz':
        await tar.x({
          file: filePath,
          cwd: extractPath,
          gzip: true
        });
        break;
        
      case 'tar.bz2':
        await tar.x({
          file: filePath,
          cwd: extractPath,
          bzip2: true
        });
        break;
        
      case 'rar':
      case '7z':
        return new Promise((resolve, reject) => {
          const stream = extract(filePath, extractPath, {
            $progress: true
          });
          
          stream.on('end', () => resolve());
          stream.on('error', (err) => reject(err));
        });
        
      default:
        throw new Error(`Unsupported archive type: ${archiveType}`);
    }
  } catch (error) {
    throw new Error(`Failed to extract ${archiveType} archive: ${error.message}`);
  }
}

// Get file tree
router.get('/:botId/tree', authenticate, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.botId, owner: req.user._id });
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    const botDir = path.join(__dirname, '../../bot-data', bot._id.toString());
    const tree = await buildFileTree(botDir, botDir);
    
    res.json(tree);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Read file
router.get('/:botId/file', authenticate, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.botId, owner: req.user._id });
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'File path required' });
    }
    
    const botDir = path.join(__dirname, '../../bot-data', bot._id.toString());
    const fullPath = path.join(botDir, filePath);
    
    // Security check
    if (!fullPath.startsWith(botDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const content = await fs.readFile(fullPath, 'utf8');
    res.json({ content, path: filePath });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Write file
router.post('/:botId/file', authenticate, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.botId, owner: req.user._id });
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    const { path: filePath, content } = req.body;
    if (!filePath || content === undefined) {
      return res.status(400).json({ error: 'File path and content required' });
    }
    
    const botDir = path.join(__dirname, '../../bot-data', bot._id.toString());
    const fullPath = path.join(botDir, filePath);
    
    // Security check
    if (!fullPath.startsWith(botDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await fs.writeFile(fullPath, content, 'utf8');
    res.json({ message: 'File saved', path: filePath });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create file/folder
router.post('/:botId/create', authenticate, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.botId, owner: req.user._id });
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    const { path: filePath, type } = req.body;
    if (!filePath || !type) {
      return res.status(400).json({ error: 'Path and type required' });
    }
    
    const botDir = path.join(__dirname, '../../bot-data', bot._id.toString());
    const fullPath = path.join(botDir, filePath);
    
    // Security check
    if (!fullPath.startsWith(botDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (type === 'folder') {
      await fs.mkdir(fullPath, { recursive: true });
    } else {
      await fs.writeFile(fullPath, '', 'utf8');
    }
    
    res.json({ message: `${type} created`, path: filePath });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Move file/folder
router.post('/:botId/move', authenticate, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.botId, owner: req.user._id });
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    const { sourcePath, destinationFolder } = req.body;
    if (!sourcePath || destinationFolder === undefined) {
      return res.status(400).json({ error: 'Source path and destination folder required' });
    }
    
    const botDir = path.join(__dirname, '../../bot-data', bot._id.toString());
    const fullSourcePath = path.join(botDir, sourcePath);
    
    // Handle root destination
    const fullDestPath = destinationFolder 
      ? path.join(botDir, destinationFolder)
      : botDir;
    
    // Security check
    if (!fullSourcePath.startsWith(botDir) || !fullDestPath.startsWith(botDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if source exists
    try {
      await fs.access(fullSourcePath);
    } catch {
      return res.status(404).json({ error: 'Source file not found' });
    }
    
    // Check if destination is a folder
    const destStats = await fs.stat(fullDestPath);
    if (!destStats.isDirectory()) {
      return res.status(400).json({ error: 'Destination must be a folder' });
    }
    
    // Get the file/folder name
    const itemName = path.basename(sourcePath);
    const newPath = path.join(fullDestPath, itemName);
    
    // Check if trying to move to same location
    if (fullSourcePath === newPath) {
      return res.status(400).json({ error: 'Source and destination are the same' });
    }
    
    // Check if destination already exists
    try {
      await fs.access(newPath);
      return res.status(400).json({ error: 'A file or folder with this name already exists in the destination' });
    } catch {
      // Good, destination doesn't exist
    }
    
    // Move the file/folder
    await fs.rename(fullSourcePath, newPath);
    
    const relativePath = path.relative(botDir, newPath);
    res.json({ 
      message: `Moved ${itemName} to ${destinationFolder || 'root'}`,
      newPath: relativePath
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Move failed' });
  }
});

// Upload file(s)
router.post('/:botId/upload', authenticate, upload.array('files'), async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.botId, owner: req.user._id });
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    const uploadedFiles = req.files.map(file => ({
      name: file.originalname,
      path: path.relative(path.join(__dirname, '../../bot-data', bot._id.toString()), file.path),
      size: file.size,
      type: file.mimetype
    }));
    
    res.json({ 
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      files: uploadedFiles
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Extract archive
router.post('/:botId/extract', authenticate, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.botId, owner: req.user._id });
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    const { archivePath, extractTo } = req.body;
    if (!archivePath) {
      return res.status(400).json({ error: 'Archive path required' });
    }
    
    const botDir = path.join(__dirname, '../../bot-data', bot._id.toString());
    const fullArchivePath = path.join(botDir, archivePath);
    const extractPath = extractTo ? path.join(botDir, extractTo) : path.dirname(fullArchivePath);
    
    // Security check
    if (!fullArchivePath.startsWith(botDir) || !extractPath.startsWith(botDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if archive exists
    try {
      await fs.access(fullArchivePath);
    } catch {
      return res.status(404).json({ error: 'Archive file not found' });
    }
    
    // Detect archive type
    const archiveType = getArchiveType(archivePath);
    if (!archiveType) {
      return res.status(400).json({ error: 'Unsupported archive format' });
    }
    
    // Extract archive
    await extractArchive(fullArchivePath, extractPath, archiveType);
    
    // Optionally delete the archive after extraction
    if (req.body.deleteAfterExtract) {
      try {
        await fs.unlink(fullArchivePath);
      } catch (unlinkError) {
        // If file doesn't exist or can't be deleted, just log it but don't fail the extraction
        console.log('Could not delete archive file:', unlinkError.message);
      }
    }
    
    res.json({ 
      message: `Archive extracted successfully`,
      archiveType,
      extractedTo: path.relative(botDir, extractPath)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Extraction failed' });
  }
});

// Create archive from selected files
router.post('/:botId/archive', authenticate, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.botId, owner: req.user._id });
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    const { items, archiveName } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array required' });
    }
    
    if (!archiveName) {
      return res.status(400).json({ error: 'Archive name required' });
    }
    
    const botDir = path.join(__dirname, '../../bot-data', bot._id.toString());
    const archivePath = path.join(botDir, archiveName);
    
    // Security check
    if (!archivePath.startsWith(botDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Create ZIP archive
    const zip = new AdmZip();
    
    for (const itemPath of items) {
      const fullPath = path.join(botDir, itemPath);
      
      // Security check
      if (!fullPath.startsWith(botDir)) {
        continue;
      }
      
      try {
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory()) {
          // Add folder and its contents
          zip.addLocalFolder(fullPath, itemPath);
        } else {
          // Add file
          zip.addLocalFile(fullPath, path.dirname(itemPath) === '.' ? '' : path.dirname(itemPath));
        }
      } catch (error) {
        console.error(`Error adding ${itemPath} to archive:`, error);
        // Continue with other files
      }
    }
    
    // Write the archive
    zip.writeZip(archivePath);
    
    res.json({ 
      message: `Archive created successfully`,
      archiveName,
      itemCount: items.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Archive creation failed' });
  }
});

// Delete file/folder
router.delete('/:botId/file', authenticate, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.botId, owner: req.user._id });
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'File path required' });
    }
    
    const botDir = path.join(__dirname, '../../bot-data', bot._id.toString());
    const fullPath = path.join(botDir, filePath);
    
    // Security check
    if (!fullPath.startsWith(botDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const stats = await fs.stat(fullPath);
    if (stats.isDirectory()) {
      await fs.rm(fullPath, { recursive: true });
    } else {
      await fs.unlink(fullPath);
    }
    
    res.json({ message: 'Deleted', path: filePath });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

async function buildFileTree(dir, baseDir) {
  const items = await fs.readdir(dir);
  const tree = [];
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stats = await fs.stat(fullPath);
    const relativePath = path.relative(baseDir, fullPath);
    
    if (stats.isDirectory()) {
      tree.push({
        name: item,
        path: relativePath,
        type: 'folder',
        children: await buildFileTree(fullPath, baseDir)
      });
    } else {
      tree.push({
        name: item,
        path: relativePath,
        type: 'file',
        size: stats.size
      });
    }
  }
  
  return tree;
}

module.exports = router;
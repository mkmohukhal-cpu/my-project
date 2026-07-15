/**
 * Reusable Google Drive utility functions.
 */
const DriveService = {
  uploadFile: function(blob, name, folderId) {
    const folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
    const file = folder.createFile(blob);
    file.setName(name);
    return file.getId();
  },
  getFile: function(fileId) {
    return DriveApp.getFileById(fileId);
  },
  deleteFile: function(fileId) {
    DriveApp.getFileById(fileId).setTrashed(true);
    return true;
  },
  generateUrl: function(fileId) {
    return DriveApp.getFileById(fileId).getUrl();
  }
};
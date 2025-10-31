// /lib/parseForm.js
// Middleware per parsare multipart/form-data con formidable (v3.x)

import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const parseForm = (req, uploadDir = '/tmp') => {
  return new Promise((resolve, reject) => {
    // Crea directory se non esiste
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Formidable 3.x syntax
    const form = formidable({
      uploadDir: uploadDir,
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      multiples: false,
      maxFields: 10
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error('Errore parsing form:', err);
        reject(err);
        return;
      }

      console.log('Form parsed successfully');
      console.log('Fields:', fields);
      console.log('Files:', Object.keys(files));

      resolve({ fields, files });
    });
  });
};

export default parseForm;

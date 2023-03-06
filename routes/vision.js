var express = require('express');
var router = express.Router();
const vision = require('@google-cloud/vision');
const multer = require('multer');
const fs = require('node:fs/promises');
const path = require('node:path');

const { STORAGE_PATH, WASTE_LABELS } = require('../config/config');

const upload = multer({
  dest: STORAGE_PATH,
  fileFilter: (req, file, cb) => { 
    if (file.mimetype.split("/")[0] === "image") {
      cb(null, true);
    } else {
      cb(new Error("Not a image file!!"), false);
    }
  }
});

const client = new vision.ImageAnnotatorClient({
  keyFilename: './cloud-keys.json'
})


async function getImageLabels(image) {
  try {
    const results = await client.labelDetection(image);
    const annotations = results[0].labelAnnotations;
    const labels = annotations.map(label => ({ label: label.description, score: label.score }));
    console.log({ labels });

    return labels;
  } catch (error) {
    throw error;
  }
}

async function emptyDirectory(directory = '') {
  try {
    for (let file of await fs.readdir(directory)) {
      await fs.unlink(path.join(directory, file));
    }
  } catch (error) {
    throw error
  }
}

/* GET users listing. */
router.post('/labels', upload.fields([{ name: 'photos', maxCount: 12 }]), async function (req, res) {
  const { photos } = req.files;

  try {
    const result = {};
    for (let photo of photos) {
      let labels = await getImageLabels(photo.path);
      let validLabels = labels.filter(({label, score}) => WASTE_LABELS.includes(label.toLowerCase()) && score > 0.7);

      result[photo.originalname] = validLabels.length > 0
    }

    emptyDirectory(STORAGE_PATH).catch(err => console.log(err));
    res.status(200).json({description: 'files with value `true` are OK for recycling', result});
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: "Operation failed." });
  }
});

module.exports = router;

const axios = require("axios");
const fs = require("fs");
const crypto = require("crypto");
const { execFile } = require("child_process");
const noblox = require("noblox.js");
const express = require("express");
const path = require("path");
const multer = require("multer");

const upload = multer({ dest: "uploads/" });
const router = express.Router();

const ALLOWED_USER_IDS = [764674203, 726882757, 127757949, 285095062, 155441001, 7041083189];

// public folder
router.use(express.static(path.join(__dirname, "public", "editor")));

const GROUP_ID = 976297917;

async function validateCookie(cookie) {
  try {
    const res = await axios.get("https://users.roblox.com/v1/users/authenticated", {
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`
      }
    });
    const userId = res.data.id;
    console.log("Authenticated user ID:", userId);
    return ALLOWED_USER_IDS.includes(userId);
  } catch (err) {
    console.error("Cookie validation failed:", err.message);
    return false;
  }
}

function hybridDecrypt(encrypted) {
  const privatePem = fs.readFileSync("private.pem", "utf8");
  const privateKey = crypto.createPrivateKey(privatePem);

  const aesKeyBytes = Buffer.from(encrypted.key, 'base64');
  const decryptedAESKey = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    aesKeyBytes
  );

  const aesKey = decryptedAESKey;
  const iv = Buffer.from(encrypted.iv, 'base64');
  const ciphertext = Buffer.from(encrypted.data, 'base64');

  const tagLength = 16; // AES-GCM tag is 16 bytes
  const encryptedText = ciphertext.slice(0, ciphertext.length - tagLength);
  const authTag = ciphertext.slice(ciphertext.length - tagLength);

  const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(encryptedText),
    decipher.final()
  ]);

  return plaintext.toString();
}

router.get("/download/:assetId", async (req, res) => {
  const assetId = req.params.assetId;

  const encCookieRaw = req.get("X-ROBLOSECURITY");

  let parsed;
  try {
    parsed = JSON.parse(encCookieRaw);
  } catch (e) {
    console.error("Failed to parse encrypted cookie JSON:", encCookieRaw);
    return res.status(400).send("Invalid encrypted cookie format");
  }

  const decCookie = hybridDecrypt(parsed);

  const inputFile = `asset_${assetId}.rbxm`;
  const outputFile = `asset_${assetId}.rbxmx`;
  console.log(`Downloading asset ${assetId}`);

  try {
    // Download RBXM
    const result = await axios.get(`https://assetdelivery.roblox.com/v1/asset?id=${assetId}`, {
      headers: { Cookie: `.ROBLOSECURITY=${decCookie}` },

      responseType: "arraybuffer",
    });
    fs.writeFileSync(inputFile, result.data);

    // Convert to RBXMX
    await new Promise((resolve, reject) => {
      execFile("/OAuth/rbxmk", [
        "run",
        "--allow-insecure-paths",
        "/OAuth/convert.lua",
        inputFile,
        outputFile
      ], (err, stdout, stderr) => {
        console.log("rbxmk stdout:", stdout);
        console.error("rbxmk stderr:", stderr);
        if (err) return reject(err);
        resolve();
      });
    });

    console.log(`Converted ${inputFile} to ${outputFile}`);
    const xmlContent = fs.readFileSync(outputFile, "utf8");
    res.setHeader("Content-Type", "application/xml");
    res.send(xmlContent);

    // Cleanup
    fs.unlinkSync(inputFile);
    fs.unlinkSync(outputFile);
  } catch (err) {
    console.error("Download/Conversion error:", err);
    res.status(500).send("Conversion or download failed");
  }
});

router.get("/assets", async (req, res) => {
  const encCookieRaw = req.get("X-ROBLOSECURITY");

  let parsed;
  try {
    parsed = JSON.parse(encCookieRaw);
  } catch (e) {
    console.error("Invalid encrypted cookie JSON in /assets:", encCookieRaw);
    return res.status(400).send("Invalid encrypted cookie format");
  }

  const decCookie = hybridDecrypt(parsed);
  const isValid = await validateCookie(decCookie);
  if (!isValid) return res.status(403).send("Unauthorized user");

  const assets = [
    { id: "126518193349912", name: "Fight It Live Sheet" },
    { id: "98216346547636", name: "Farm It Live Sheet" },
 //   { id: "74281801112410", name: "Fight It Dev Sheet" },
 //   { id: "133565537486151", name: "Farm It Dev Sheet" },
    { id: "78246014523294", name: "Fight It FFlags" },
    { id: "118453303984006", name: "Farm It FFlags" },
  ];
  res.json(assets);
});

router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "editor", "index.html"));
});

router.post("/upload", upload.single("file"), async (req, res) => {
  const assetId = req.body.assetId;

  const encCookieRaw = req.get("X-ROBLOSECURITY");

  let parsed;
  try {
    parsed = JSON.parse(encCookieRaw);
  } catch (e) {
    console.error("Failed to parse encrypted cookie JSON:", encCookieRaw);
    return res.status(400).send("Invalid encrypted cookie format");
  }

  const decCookie = hybridDecrypt(parsed);

  const filePath = req.file.path;

  try {
    await noblox.setCookie(decCookie);

    const response = await noblox.uploadModel(
      fs.readFileSync(filePath),
      {
        name: "Uploaded via API",
        description: "Uploaded file",
        isPublic: false,
        groupId: GROUP_ID,
      },
      parseInt(assetId)
    );
    res.json({ success: true, assetId: response });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).send("Upload failed");
  } finally {
    fs.unlinkSync(filePath); // cleanup
  }
});

module.exports = router;
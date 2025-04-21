const express = require('express');
const { createCanvas, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();

// Helper function to download the font if it doesn't exist
const downloadFont = (url, outputPath, callback) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, (response) => {
        response.pipe(file);
        file.on('finish', () => {
            file.close(callback);
        });
    }).on('error', (err) => {
        fs.unlink(outputPath, () => {}); // Delete the file if an error occurs
        console.error(`Error downloading font: ${err.message}`);
    });
};

app.get('/', (req, res) => {
    res.send('Welcome! Use the /time endpoint with query parameters like ?font=Pixel&tz=America/New_York to get the current time as an image.');
});

app.get('/time', (req, res) => {
    const { font = 'Arial', tz = 'UTC', fontSize = '40', color = 'black', bgColor = 'transparent' } = req.query;

    let fontFamily = font;
    const fontSizePx = parseInt(fontSize, 10);

    // Handle the Pixel font
    if (font === 'Pixel') {
        const fontPath = path.resolve('./fonts/ms_sans_serif.woff2');
        if (!fs.existsSync(fontPath)) {
            console.log('Downloading Pixel font...');
            downloadFont('https://unpkg.com/98.css@0.1.20/dist/ms_sans_serif.woff2', fontPath, () => {
                registerFont(fontPath, { family: 'Pixel' });
            });
        } else {
            registerFont(fontPath, { family: 'Pixel' });
        }
        fontFamily = 'Pixel';
    } else {
        // Register the font if provided
        try {
            registerFont(`./fonts/${font}.ttf`, { family: font });
        } catch (err) {
            console.error(`Font not found: ${font}, falling back to Arial.`);
            fontFamily = 'Arial'; // Fallback to Arial
        }
    }

    // Get the current time in 24-hour format
    let currentTime;
    try {
        currentTime = new Date().toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
    } catch (err) {
        console.error(`Invalid time zone: ${tz}, falling back to UTC.`);
        currentTime = new Date().toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' });
    }

    // Create a temporary canvas to measure text dimensions
    const tempCanvas = createCanvas(1, 1);
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.font = `${fontSizePx}px ${fontFamily}`;
    const textWidth = tempCtx.measureText(currentTime).width;
    const textHeight = fontSizePx * 1.2; // Approximation for text height

    // Create a canvas with dynamic size
    const canvas = createCanvas(textWidth + 2, textHeight + 2); // Add padding
    const ctx = canvas.getContext('2d');

    // Set background color
    if (bgColor !== 'transparent') {
        ctx.fillStyle = bgColor; // Use the provided background color
        ctx.fillRect(0, 0, canvas.width, canvas.height); // Fill the background
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Transparent background
    }

    // Draw the text
    ctx.fillStyle = color; // Use the provided text color
    ctx.font = `${fontSizePx}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(currentTime, canvas.width / 2, canvas.height / 2);

    // Send the PNG as a response
    res.setHeader('Content-Type', 'image/png');
    canvas.createPNGStream().pipe(res);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
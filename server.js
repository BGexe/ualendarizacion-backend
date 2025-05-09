//const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");

require('dotenv').config();  // Cargar las variables de entorno

const app = express();
app.use(cors());
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,  // Usar la variable de entorno
  resave: false,
  saveUninitialized: true
}));

// Configuración OAuth2 para Google Calendar
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,  // Usar la variable de entorno
  process.env.GOOGLE_CLIENT_SECRET,  // Usar la variable de entorno
  "http://localhost:3000/auth/google/callback"
);

// Servicio: Autenticación con Google
app.get('/auth/google', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.readonly']
  });
  res.redirect(authUrl);
});

// Servicio: Callback de Google OAuth
app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  req.session.tokens = tokens;
  res.send("Autenticación exitosa.");
});

// Servicio: Obtener eventos de Google Calendar
app.get('/api/calendar/events', async (req, res) => {
  if (!req.session.tokens) {
    return res.status(401).send('No estás autenticado.');
  }

  oauth2Client.setCredentials(req.session.tokens);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  try {
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });

    res.json(response.data.items);
  } catch (error) {
    res.status(500).send('Error al obtener eventos');
  }
});

// Servicio: Enviar correo
app.post('/send-email', async (req, res) => {
  const { to_email, subject, message } = req.body;

  if (!to_email || !subject || !message) {
    return res.status(400).json({ error: "Faltan datos en la solicitud" });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,  // Usar la variable de entorno
        pass: process.env.GMAIL_PASS   // Usar la variable de entorno
      }
    });

    await transporter.sendMail({
      from: process.env.GMAIL_USER,  // Usar la variable de entorno
      to: to_email,
      subject: subject,
      text: message
    });

    res.status(200).json({ message: `Correo enviado a ${to_email}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Exportar como función HTTP para Firebase

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

//exports.api = functions.https.onRequest(app);
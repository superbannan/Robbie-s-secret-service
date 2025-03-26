const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

// Set up MongoDB connection
mongoose.connect('mongodb://localhost:27017/proxy-site', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log(err));

const app = express();

// Middleware
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'secret_key', // Change this to a more secure key in production
    resave: false,
    saveUninitialized: true,
}));

// MongoDB user schema
const userSchema = new mongoose.Schema({
    username: String,
    password: String
});

const User = mongoose.model('User', userSchema);

// Serve the login page
app.get('/', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/proxy');
    }
    res.sendFile(__dirname + '/public/login.html');
});

// Sign-up route
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
        return res.status(400).send('Username already exists');
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    res.redirect('/');
});

// Sign-in route
app.post('/signin', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(400).send('Invalid username or password');
    }

    req.session.userId = user._id;
    res.redirect('/proxy');
});

// Proxy route to search
app.get('/search', async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/');
    }

    const query = req.query.q;
    if (!query) {
        return res.status(400).send('Search query is required');
    }

    try {
        const searchResult = await axios.get(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
        res.send(searchResult.data);
    } catch (error) {
        res.status(500).send('Error searching the web');
    }
});

// Proxy search page
app.get('/proxy', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/');
    }
    res.sendFile(__dirname + '/public/proxy.html');
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Start the server
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});

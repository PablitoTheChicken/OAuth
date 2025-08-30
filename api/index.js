const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/game', require('./game'));
router.use('/user', require('./user'));
router.use('/editor', require('./editor'));
router.use('/mail', require('./mail'));

router.get('/', (req, res) => {
  res.json({ message: 'Ok' });
});

module.exports = router;

const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/game', require('./game'));
router.use('/user', require('./user'));

module.exports = router;

const mongoose = require("mongoose");

mongoose.connect("mongodb+srv://smartpathaibdbi:1234@smartpathai.17jm8.mongodb.net/LoginFormPractice?retryWrites=true&w=majority")
  .then(() => {
    console.log('Mongoose connected to LoginFormPractice database');
  })
  .catch((e) => {
    console.log('MongoDB connection failed:', e.message);
  });

const logInSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date
});

const LogInCollection = mongoose.model('LogInCollection', logInSchema);

module.exports = LogInCollection;
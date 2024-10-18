const express = require("express")
const path = require("path")
const app = express()
const LogInCollection = require("./mongo")
const port = process.env.PORT || 3000

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

const tempelatePath = path.join(__dirname, '../tempelates')
const publicPath = path.join(__dirname, '../public')
console.log(publicPath);

app.set('view engine', 'hbs')
app.set('views', tempelatePath)
app.use(express.static(publicPath))

app.get('/signup', (req, res) => {
    res.render('signup')
})

app.get('/', (req, res) => {
    res.render('login')
})

app.get('/forgot-password', (req, res) => {
  res.render('forgot-password')
})

app.post('/signup', async (req, res) => {
    const data = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        password: req.body.password
    }

    try {
        const checking = await LogInCollection.findOne({ email: req.body.email })
        if (checking) {
            return res.send("User with this email already exists")
        } else {
            const newUser = await LogInCollection.create(data)
            console.log('User created:', newUser)
            return res.status(201).render("home", {
                naming: `${req.body.firstName} ${req.body.lastName}`
            })
        }
    } catch (error) {
        console.error('Error during signup:', error)
        return res.status(500).send("An error occurred during signup")
    }
})

const crypto = require('crypto')
const nodemailer = require('nodemailer')

app.post('/forgot-password', async (req, res) => {
    const { email } = req.body
    try {
        const user = await LogInCollection.findOne({ email })
        if (!user) {
            return res.status(404).send('User not found')
        }
        
        // Generate reset token
        const resetToken = crypto.randomBytes(20).toString('hex')
        user.resetPasswordToken = resetToken
        user.resetPasswordExpires = Date.now() + 3600000 // 1 hour
        await user.save()

        // Send email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'your-email@gmail.com',
                pass: 'your-email-password'
            }
        })

        const mailOptions = {
            from: 'your-email@gmail.com',
            to: user.email,
            subject: 'Password Reset',
            text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
            Please click on the following link, or paste this into your browser to complete the process:\n\n
            http://${req.headers.host}/reset-password/${resetToken}\n\n
            If you did not request this, please ignore this email and your password will remain unchanged.\n`
        }

        await transporter.sendMail(mailOptions)
        res.send('An email has been sent to ' + user.email + ' with further instructions.')
    } catch (error) {
        console.error('Error in forgot password:', error)
        res.status(500).send('An error occurred')
    }
})

app.get('/reset-password/:token', async (req, res) => {
  try {
      const user = await LogInCollection.findOne({
          resetPasswordToken: req.params.token,
          resetPasswordExpires: { $gt: Date.now() }
      })
      if (!user) {
          return res.status(400).send('Password reset token is invalid or has expired.')
      }
      res.render('reset-password', { token: req.params.token })
  } catch (error) {
      console.error('Error in reset password get:', error)
      res.status(500).send('An error occurred')
  }
})

app.post('/reset-password/:token', async (req, res) => {
  try {
      const user = await LogInCollection.findOne({
          resetPasswordToken: req.params.token,
          resetPasswordExpires: { $gt: Date.now() }
      })
      if (!user) {
          return res.status(400).send('Password reset token is invalid or has expired.')
      }
      if (req.body.password !== req.body.confirmPassword) {
          return res.status(400).send('Passwords do not match.')
      }
      user.password = req.body.password
      user.resetPasswordToken = undefined
      user.resetPasswordExpires = undefined
      await user.save()
      res.send('Your password has been changed successfully.')
  } catch (error) {
      console.error('Error in reset password post:', error)
      res.status(500).send('An error occurred')
  }
})

app.listen(port, () => {
    console.log('port connected');
})
const express = require("express")
const { open } = require("sqlite")
const sqlite3 = require("sqlite3")
const path = require("path")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")

const app = express()
app.use(express.json())

// ✅ DB PATH (Render-safe)
const dbPath = process.env.DB_PATH || path.join(__dirname, "finance.db")
let db = null

// ⚠️ For production you'd use .env, but keeping simple
const JWT_SECRET = "MY_SECRET_TOKEN"

// -------------------- MIDDLEWARES --------------------

// Authenticate Token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]

  if (!authHeader) {
    return res.status(401).send("Invalid JWT Token")
  }

  const jwtToken = authHeader.split(" ")[1]

  jwt.verify(jwtToken, JWT_SECRET, (error, payload) => {
    if (error) {
      return res.status(401).send("Invalid JWT Token")
    }
    req.user = payload
    next()
  })
}

// Authorize Roles
const authorizeRoles = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).send("Access Denied")
    }
    next()
  }
}

// -------------------- DEFAULT ADMIN --------------------

const createDefaultAdmin = async () => {
  const adminUser = await db.get(
    `SELECT * FROM users WHERE username = ?`,
    ["admin_user"]
  )

  if (!adminUser) {
    const hashedPassword = await bcrypt.hash("admin123", 10)

    await db.run(
      `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
      ["admin_user", hashedPassword, "admin"]
    )

    console.log("Default admin created")
  }
}

// -------------------- INITIALIZE --------------------

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })

    // USERS TABLE
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('viewer', 'analyst', 'admin')) NOT NULL,
        status TEXT CHECK(status IN ('active', 'inactive')) DEFAULT 'active'
      );
    `)

    // TRANSACTIONS TABLE
    await db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        amount REAL NOT NULL,
        type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
        category TEXT,
        date TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
    `)

    await createDefaultAdmin()

    // -------------------- ROUTES --------------------

    app.get("/", (req, res) => {
      res.send("Server is running")
    })

    // REGISTER
    app.post("/register/", async (req, res) => {
      const { username, password, role } = req.body

      const user = await db.get(
        `SELECT * FROM users WHERE username = ?`,
        [username]
      )

      if (user) {
        return res.status(400).send("User already exists")
      }

      if (!password || password.length < 6) {
        return res.status(400).send("Password is too short")
      }

      const hashedPassword = await bcrypt.hash(password, 10)
      const userRole = role || "viewer"

      await db.run(
        `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
        [username, hashedPassword, userRole]
      )

      res.send("User created successfully")
    })

    // LOGIN
    app.post("/login/", async (req, res) => {
      const { username, password } = req.body

      const user = await db.get(
        `SELECT * FROM users WHERE username = ?`,
        [username]
      )

      if (!user) {
        return res.status(400).send("Invalid user")
      }

      const isPasswordMatched = await bcrypt.compare(
        password,
        user.password
      )

      if (!isPasswordMatched) {
        return res.status(400).send("Invalid password")
      }

      if (user.status === "inactive") {
        return res.status(403).send("User is inactive")
      }

      const payload = {
        userId: user.id,
        role: user.role,
      }

      const token = jwt.sign(payload, JWT_SECRET)

      res.send({ jwtToken: token })
    })

    // CREATE TRANSACTION
    app.post(
      "/transactions/",
      authenticateToken,
      authorizeRoles(["admin"]),
      async (req, res) => {
        const { amount, type, category, date, notes } = req.body
        const { userId } = req.user

        if (!amount || amount <= 0) {
          return res.status(400).send("Invalid amount")
        }

        if (type !== "income" && type !== "expense") {
          return res.status(400).send("Invalid type")
        }

        await db.run(
          `INSERT INTO transactions 
           (user_id, amount, type, category, date, notes)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, amount, type, category, date, notes]
        )

        res.send("Transaction created successfully")
      }
    )

    // GET TRANSACTIONS
    app.get(
      "/transactions/",
      authenticateToken,
      authorizeRoles(["viewer", "analyst", "admin"]),
      async (req, res) => {
        const { userId, role } = req.user

        const query =
          role === "admin"
            ? `SELECT * FROM transactions`
            : `SELECT * FROM transactions WHERE user_id = ?`

        const data =
          role === "admin"
            ? await db.all(query)
            : await db.all(query, [userId])

        res.send(data)
      }
    )

    // UPDATE TRANSACTION
    app.put(
      "/transactions/:id/",
      authenticateToken,
      authorizeRoles(["admin"]),
      async (req, res) => {
        const { id } = req.params
        const { amount, type, category, date, notes } = req.body

        const transaction = await db.get(
          `SELECT * FROM transactions WHERE id = ?`,
          [id]
        )

        if (!transaction) {
          return res.status(404).send("Transaction not found")
        }

        if (!amount || amount <= 0) {
          return res.status(400).send("Invalid amount")
        }

        if (type !== "income" && type !== "expense") {
          return res.status(400).send("Invalid type")
        }

        await db.run(
          `UPDATE transactions
           SET amount=?, type=?, category=?, date=?, notes=?
           WHERE id=?`,
          [amount, type, category, date, notes, id]
        )

        res.send("Transaction updated successfully")
      }
    )

    // DELETE TRANSACTION
    app.delete(
      "/transactions/:id/",
      authenticateToken,
      authorizeRoles(["admin"]),
      async (req, res) => {
        const { id } = req.params

        const transaction = await db.get(
          `SELECT * FROM transactions WHERE id = ?`,
          [id]
        )

        if (!transaction) {
          return res.status(404).send("Transaction not found")
        }

        await db.run(`DELETE FROM transactions WHERE id = ?`, [id])

        res.send("Transaction deleted successfully")
      }
    )

    // SUMMARY
    app.get(
      "/summary/",
      authenticateToken,
      authorizeRoles(["analyst", "admin"]),
      async (req, res) => {
        const { userId, role } = req.user

        const incomeQuery =
          role === "admin"
            ? `SELECT SUM(amount) AS totalIncome FROM transactions WHERE type='income'`
            : `SELECT SUM(amount) AS totalIncome FROM transactions WHERE type='income' AND user_id=?`

        const expenseQuery =
          role === "admin"
            ? `SELECT SUM(amount) AS totalExpense FROM transactions WHERE type='expense'`
            : `SELECT SUM(amount) AS totalExpense FROM transactions WHERE type='expense' AND user_id=?`

        const income =
          role === "admin"
            ? await db.get(incomeQuery)
            : await db.get(incomeQuery, [userId])

        const expense =
          role === "admin"
            ? await db.get(expenseQuery)
            : await db.get(expenseQuery, [userId])

        const totalIncome = income.totalIncome || 0
        const totalExpense = expense.totalExpense || 0

        res.send({
          totalIncome,
          totalExpense,
          balance: totalIncome - totalExpense,
        })
      }
    )

    // CATEGORY SUMMARY
    app.get(
      "/summary/category/",
      authenticateToken,
      authorizeRoles(["analyst", "admin"]),
      async (req, res) => {
        const { userId, role } = req.user

        const query =
          role === "admin"
            ? `SELECT category, SUM(amount) AS total FROM transactions GROUP BY category`
            : `SELECT category, SUM(amount) AS total FROM transactions WHERE user_id=? GROUP BY category`

        const data =
          role === "admin"
            ? await db.all(query)
            : await db.all(query, [userId])

        res.send(data)
      }
    )

    
    const PORT = process.env.PORT || 3000

    app.listen(PORT, () => {
      console.log(`Server Running at http://localhost:${PORT}/`)
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

module.exports = app

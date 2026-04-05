# 💰 Finance Management Backend API

## 📌 Overview

This is a backend application built using **Node.js, Express, and SQLite** to manage financial transactions.
It supports **authentication, role-based access control, CRUD operations, and data aggregation (summary APIs)**.

---

## 🚀 Tech Stack

* Node.js
* Express.js
* SQLite
* JWT (Authentication)
* bcrypt (Password hashing)

---

## 🔐 Authentication & Authorization

* JWT-based authentication
* Role-based access:

  * **Admin** → Full access (Create, Update, Delete, View)
  * **Analyst** → View + Summary
  * **Viewer** → View only

---

## 👤 Default Admin

A default admin is created automatically:

```
Username: admin_user
Password: admin123
```

---

## ⚙️ Setup Instructions

1. Install dependencies:

```
npm install
```

2. Run the server:

```
node app.js
```

3. Server runs at:

```
http://localhost:3000/
```

---

## 📡 API Endpoints

### 🔹 Auth APIs

#### Register

```
POST /register/
```

#### Login

```
POST /login/
```

---

### 🔹 Transaction APIs

#### Create Transaction (Admin only)

```
POST /transactions/
```

#### Get Transactions (All users)

```
GET /transactions/
```

#### Update Transaction (Admin only)

```
PUT /transactions/:id/
```

#### Delete Transaction (Admin only)

```
DELETE /transactions/:id/
```

---

### 🔹 Summary APIs

#### Overall Summary (Admin, Analyst)

```
GET /summary/
```

Returns:

* Total Income
* Total Expense
* Balance

---

#### Category-wise Summary (Admin, Analyst)

```
GET /summary/category/
```

Returns:

* Total amount per category

---

## 🧠 Features

* Secure password storage using bcrypt
* JWT-based authentication
* Role-based authorization using middleware
* Full CRUD operations
* Aggregation using SQL (SUM, GROUP BY)
* Clean and scalable backend structure

---

## 📌 Notes

* Only Admin can modify transactions
* Viewer and Analyst have restricted access
* Passwords are hashed before storing in DB

---

## 🏁 Conclusion

This project demonstrates:

* Backend API design
* Authentication & authorization
* Database operations
* Clean code structure

---

✨ Built as part of backend development practice

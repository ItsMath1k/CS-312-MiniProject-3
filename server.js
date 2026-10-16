const express = require("express");
const pool = require("./db");
const session = require("express-session");
const bcrypt = require("bcrypt");

const app = express();
const PORT = 3000;

app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60
    }
}));
app.use(express.static("public"));

app.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                blog_id AS id,
                creator_name AS name,
                creator_user_id,
                title,
                body AS content,
                date_created AS time
            FROM blogs
            ORDER by date_created DESC`
        );

        res.render("index", { 
            posts: result.rows, 
            user: req.session.user || null
        });
    } catch (error) {
        console.error("Error fetching posts:", error.message);
        res.status(500).send("Unable to load blog posts.");
    }
    
});

app.post("/posts", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/signin");
    }

    const { title, content } = req.body;

    if (!title?.trim() || !content?.trim()) {
        return res.status(400).send("Title and content are required.");
    }

    try {
        await pool.query(
            `INSERT INTO blogs (creator_name, creator_user_id, title, body)
            VALUES ($1, $2, $3, $4)`,
            [
                req.session.user.name,
                req.session.user.user_id,
                title.trim(),
                content.trim()
            ]
        );

        res.redirect("/");
    } catch (error) {
        console.error("Error creating post:", error.message);
        res.status(500).send("Unable to create blog post.");
    }
});

app.get("/posts/:id/edit", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/signin");
    }

    try {
        const result = await pool.query(
            `SELECT
                blog_id AS id,
                creator_name AS name,
                creator_user_id,
                title,
                body AS content,
                date_created AS time
            FROM blogs
            WHERE blog_id = $1
                AND creator_user_id = $2`,
            [req.params.id, req.session.user.user_id]
        );

        const post = result.rows[0];

        if (!post) {
            return res.status(404).send("Blog post not found or you do not have permission to edit it.");
        }

        res.render("edit", { post: post });
    } catch (error) {
        console.error("Error fetching post for editing:", error.message);
        res.status(500).send("Unable to load blog post.");
    }
});

app.post("/posts/:id/edit", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/signin");
    }

    const { title, content } = req.body;

    if (!title?.trim() || !content?.trim()) {
        return res.status(400).send("Title and content are required.");
    }

    try {
        const result = await pool.query(
            `UPDATE blogs
            SET title = $1,
                body = $2
            WHERE blog_id = $3
                AND creator_user_id = $4
            RETURNING blog_id`,
            [
                title.trim(),
                content.trim(),
                req.params.id,
                req.session.user.user_id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).send("Blog post not found or you do not have permission to edit it.");
        }

        res.redirect("/");
    } catch (error) {
        console.error("Error updating post:", error.message);
        res.status(500).send("Unable to update blog post.");
    }
});

app.post("/posts/:id/delete", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/signin");
    }

    try {
        const result = await pool.query(
            `DELETE FROM blogs
            WHERE blog_id = $1
                AND creator_user_id = $2
            RETURNING blog_id`,
            [req.params.id, req.session.user.user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).send("Blog post not found or you do not have permission to delete it.");
        }

        res.redirect("/");
    } catch (error) {
        console.error("Error deleting post:", error.message);
        res.status(500).send("Unable to delete blog post.");
    }
});

app.get("/signup", (req, res)=> {
    res.render("signup");
});

app.post("/signup", async (req, res)=> {
    const { name, user_id, password } = req.body;

    if (!name?.trim() || !user_id?.trim() || !password) {
        return res.status(400).send("All fields are required.");
    }

    try {
        const passwordHash = await bcrypt.hash(password,12);

        await pool.query(
            `INSERT INTO users (user_id, password, name)
            VALUES ($1, $2, $3)`,
            [user_id.trim(), passwordHash, name.trim()]
        );

        res.redirect("/signin");
    } catch(error) {
        if (error.code === "23505") {
            return res.status(409).send("That username is already taken");
        }

        console.error("Error creating account:", error.message);
        res.status(500).send("Unable to create account.");
    }
});

app.get("/signin", (req, res) => {
    res.render("signin");
});

app.post("/signin", async (req, res) => {
    const { user_id, password } = req.body;

    if (!user_id?.trim() || !password) {
        return res.status(400).send("Username and password are required.");
    }

    try {
        const result = await pool.query(
            `SELECT user_id, name, password
            FROM users
            WHERE user_id = $1`,
            [user_id.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).send("Invalid username or password.");
        }

        const user = result.rows[0];
        const passwordMatches = await bcrypt.compare(password, user.password);

        if (!passwordMatches) {
            return res.status(401).send("Invalid username or password.");
        }

        req.session.user = {
            user_id: user.user_id,
            name: user.name
        };

        res.redirect("/");
    } catch (error) {
        console.error("Error signing in:", error.message);
        res.status(500).send("Unable to sign in.");
    }
});

app.post("/logout", (req, res, next) => {
    req.session.destroy(error => {
        if (error) {
            return next(error);
        }

        res.clearCookie("connect.sid");
        res.redirect("/signin");
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
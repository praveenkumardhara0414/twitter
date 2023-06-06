const express = require("express");
const { open } = require("sqlite");
const path = require("path");
const sqlite3 = require("sqlite3");
const app = express();
let db = null;
app.use(express.json());
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dbPath = path.join(__dirname, "twitterClone.db");
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "praveen_dure", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//register API-1
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const getUserDetails = `
        SELECT * FROM user WHERE username = '${username}'
    `;
  const userDetails = await db.get(getUserDetails);
  if (userDetails === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const addRequestQuery = `
                INSERT INTO user(name, username, password, gender)
                VALUES('${name}', '${username}', '${hashedPassword}', '${gender}');
            `;
      await db.run(addRequestQuery);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//login API-2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserDetails = `
        SELECT * FROM user WHERE username = '${username}';
    `;
  const dbUser = await db.get(getUserDetails);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "praveen_dure");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Get a tweets of a user API-3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const userName = request.username;
  const addQuery = `
    SELECT * FROM user WHERE username = '${userName}';
  `;
  const result = await db.get(addQuery);
  const { user_id } = result;
  const followingUserQuery = `
    SELECT * FROM follower WHERE follower_user_id = ${user_id};
  `;
  const responseResult = await db.all(followingUserQuery);

  const arrayOfIds = responseResult.map(
    (eachObject) => eachObject.following_user_id
  );
  const getTweetsQuery = `
    SELECT username, tweet, date_time AS dateTime
    FROM user INNER JOIN tweet ON user.user_id = tweet.user_id
    WHERE user.user_id IN (${arrayOfIds})
    ORDER BY date_time DESC
    LIMIT 4;
  `;
  const tweets = await db.all(getTweetsQuery);
  response.send(tweets);
});

//Get following users API-4
app.get("/user/following/", authenticateToken, async (request, response) => {
  const userName = request.username;
  const addQuery = `
    SELECT * FROM user WHERE username = '${userName}';
  `;
  const result = await db.get(addQuery);
  const { user_id } = result;
  const followingUserQuery = `
    SELECT * FROM follower WHERE follower_user_id = ${user_id};
  `;
  const responseResult = await db.all(followingUserQuery);

  const arrayOfIds = responseResult.map(
    (eachObject) => eachObject.following_user_id
  );
  const getTweetsQuery = `
    SELECT name
    FROM user 
    WHERE user_id IN (${arrayOfIds})
    ;
  `;
  const tweets = await db.all(getTweetsQuery);
  response.send(tweets);
});

//Get followers names API-5
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const userName = request.username;
  const addQuery = `
    SELECT * FROM user WHERE username = '${userName}';
  `;
  const result = await db.get(addQuery);
  const { user_id } = result;
  const followingUserQuery = `
    SELECT * FROM follower WHERE following_user_id = ${user_id};
  `;
  const responseResult = await db.all(followingUserQuery);

  const arrayOfIds = responseResult.map(
    (eachObject) => eachObject.follower_user_id
  );
  const getTweetsQuery = `
    SELECT name
    FROM user 
    WHERE user_id IN (${arrayOfIds})
    ;
  `;
  const tweets = await db.all(getTweetsQuery);
  response.send(tweets);
});

//get tweets API-6
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const userName = request.username;
  const { tweetId } = request.params;
  const addQuery = `
    SELECT * FROM user WHERE username = '${userName}';
  `;
  const result = await db.get(addQuery);
  const { user_id } = result;
  const followingUserQuery = `
    SELECT * FROM follower WHERE follower_user_id = ${user_id};
  `;
  const responseResult = await db.all(followingUserQuery);

  const arrayOfIds = responseResult.map(
    (eachObject) => eachObject.following_user_id
  );
  const getTweetQuery = `
    SELECT * FROM tweet WHERE 
    tweet_id = ${tweetId} ;
  `;
  const resultItem = await db.get(getTweetQuery);
  let isFollowing = false;
  const userDetails = resultItem.user_id;
  for (let item of arrayOfIds) {
    if (item === userDetails) {
      isFollowing = true;
      break;
    }
  }
  if (isFollowing === false) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const getRequest = `
        SELECT tweet.tweet, COUNT(like_id) AS likes, COUNT(reply_id) AS replies ,tweet.date_time AS dateTime FROM 
        (tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id) AS D INNER JOIN reply ON D.tweet_id = reply.tweet_id 
        WHERE tweet.tweet_id = ${tweetId};
    `;
    const resultResponse = await db.get(getRequest);
    response.send(resultResponse);
  }
});

//Get user names API-7
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const userName = request.username;
    const { tweetId } = request.params;
    const addQuery = `
    SELECT * FROM user WHERE username = '${userName}';
  `;
    const result = await db.get(addQuery);
    const { user_id } = result;
    const followingUserQuery = `
    SELECT * FROM follower WHERE follower_user_id = ${user_id};
  `;
    const responseResult = await db.all(followingUserQuery);

    const arrayOfIds = responseResult.map(
      (eachObject) => eachObject.following_user_id
    );
    const getTweetQuery = `
    SELECT * FROM tweet WHERE 
    tweet_id = ${tweetId} ;
  `;
    const resultItem = await db.get(getTweetQuery);
    let isFollowing = false;
    const userDetails = resultItem.user_id;
    for (let item of arrayOfIds) {
      if (item === userDetails) {
        isFollowing = true;
        break;
      }
    }
    if (isFollowing === false) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const getRequest = `
        SELECT * FROM 
        like WHERE tweet_id = ${tweetId};

      `;
      const resultResponse = await db.all(getRequest);
      const userIds = resultResponse.map((eachObject) => eachObject.user_id);
      const getQuery = `
        SELECT name  FROM user
        WHERE user_id IN (${userIds});
      `;
      const userNames = await db.all(getQuery);
      const getNames = userNames.map((eachObject) => eachObject.name);
      response.send({ likes: getNames });
    }
  }
);
//Get replies API-8
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const userName = request.username;
    const { tweetId } = request.params;
    const addQuery = `
    SELECT * FROM user WHERE username = '${userName}';
  `;
    const result = await db.get(addQuery);
    const { user_id } = result;
    const followingUserQuery = `
    SELECT * FROM follower WHERE follower_user_id = ${user_id};
  `;
    const responseResult = await db.all(followingUserQuery);

    const arrayOfIds = responseResult.map(
      (eachObject) => eachObject.following_user_id
    );
    const getTweetQuery = `
    SELECT * FROM tweet WHERE 
    tweet_id = ${tweetId} ;
  `;
    const resultItem = await db.get(getTweetQuery);
    let isFollowing = false;
    const userDetails = resultItem.user_id;
    for (let item of arrayOfIds) {
      if (item === userDetails) {
        isFollowing = true;
        break;
      }
    }
    if (isFollowing === false) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const getRequest = `
        SELECT * FROM 
        reply WHERE tweet_id = ${tweetId};

      `;
      const resultResponse = await db.all(getRequest);
      const userIds = resultResponse.map((eachObject) => eachObject.user_id);
      const getQuery = `
        SELECT name , reply  FROM 
        user INNER JOIN reply ON user.user_id = reply.reply_id
        WHERE user.user_id IN (${userIds});
      `;
      const userNames = await db.all(getQuery);
      const getNames = userNames.map((eachObject) => eachObject.name);
      response.send({ replies: userNames });
    }
  }
);

//Get user tweets API-9
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const userName = request.username;
  const addQuery = `
    SELECT * FROM user WHERE username = '${userName}';
  `;
  const result = await db.get(addQuery);
  const { user_id } = result;
  const requestQuery = `SELECT * FROM tweet WHERE user_id = ${user_id}; `;
  const requestQueryResult = await db.all(requestQuery);
  const tweetIds = requestQueryResult.map((eachObject) => eachObject.tweet_id);
  const getQuery = `
    SELECT tweet, COUNT(DISTINCT like_id) AS likes, COUNT(DISTINCT reply_id) AS replies, tweet.date_time AS dateTime FROM
    (tweet LEFT JOIN like ON tweet.tweet_id = like.tweet_id) AS D LEFT JOIN reply ON D.tweet_id = reply.tweet_id 
    WHERE tweet.user_id = ${user_id}
    GROUP BY tweet.tweet_id;
  `;
  const getResult = await db.all(getQuery);
  response.send(getResult);
});

//Post a tweet API-10
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const userName = request.username;
  const addQuery = `
    SELECT * FROM user WHERE username = '${userName}';
  `;
  const result = await db.get(addQuery);
  const { user_id } = result;
  const date = new Date();
  const addRequestQuery = `
        INSERT INTO tweet(tweet, user_id, date_time)
        VALUES('${tweet}', ${user_id}, '${date}'); 

    `;
  const responseResult = await db.run(addRequestQuery);

  response.send("Created a Tweet");
});

//Delete a tweet API-11
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const userName = request.username;
    const addQuery = `
    SELECT * FROM user WHERE username = '${userName}';
  `;
    const result = await db.get(addQuery);
    const { user_id } = result;
    const requestQuery = `SELECT * FROM tweet WHERE user_id = ${user_id}; `;
    const requestQueryResult = await db.all(requestQuery);
    const tweetIds = requestQueryResult.map(
      (eachObject) => eachObject.tweet_id
    );
    let isValid = false;
    for (let item of tweetIds) {
      if (item === parseInt(tweetId)) {
        isValid = true;
        break;
      }
    }
    if (isValid === false) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const deleteRequest = `
          DELETE FROM tweet WHERE tweet_id = ${tweetId};
        `;
      const resultantQuery = await db.run(deleteRequest);
      response.send("Tweet Removed");
    }
  }
);

module.exports = app;

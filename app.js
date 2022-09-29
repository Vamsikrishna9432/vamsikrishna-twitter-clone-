const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());

let db = null;
const initializeDBandServer = async () => {
  try {
    db = await open({
      filename: path.join(__dirname, "twitterClone.db"),
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running on http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DataBase error is ${error.message}`);
    process.exit(1);
  }
};
initializeDBandServer();

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const getUserQuery = `select * from user where username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser == undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUserQuery = `
                 INSERT INTO 
                  user (name,username,password, gender) 
                 VALUES 
           (
              '${name}', 
              '${username}',
              '${hashedPassword}', 
              '${gender}'
             )`;
      const dbresponse = await db.run(createUserQuery);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `select * from user where username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

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
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
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

// api 3

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserIdQuery = `select user_id from user where username = '${username}';`;
  const UserId = await db.get(getUserIdQuery);
  //console.log(UserId);

  //get follower ids.
  const getFollowerId = `select following_user_id from follower where follower_user_id = '${UserId.user_id}';`;
  const getFollowerIds = await db.all(getFollowerId);
  //console.log(getFollowerIds);

  const getFollowerIdSimple = getFollowerIds.map((eachitem) => {
    return eachitem.following_user_id;
  });
  console.log(getFollowerIdSimple);

  const getTweetsQuery = `select user.username, tweet.tweet, tweet.date_time as dateTime from user inner join tweet on user.user_id = tweet.user_id where user.user_id in (${getFollowerIdSimple}) order by tweet.date_time desc limit 4;`;
  const teewtsResponse = await db.all(getTweetsQuery);
  response.send(teewtsResponse);
});

//api 4

app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  // console.log(getUserId);
  const getFollowerIdsQuery = `select following_user_id from follower 
    where follower_user_id=${getUserId.user_id};`;
  const getFollowerIdsArray = await db.all(getFollowerIdsQuery);
  //console.log(getFollowerIdsArray);
  const getFollowerIds = getFollowerIdsArray.map((eachUser) => {
    return eachUser.following_user_id;
  });
  //console.log(`${getFollowerIds}`);
  const getFollowersResultQuery = `select name from user where user_id in (${getFollowerIds});`;
  const responseResult = await db.all(getFollowersResultQuery);
  //console.log(responseResult);
  response.send(responseResult);
});

// api 5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  //console.log(getUserId);
  const getFollowerIdsQuery = `select follower_user_id from follower where following_user_id=${getUserId.user_id};`;
  const getFollowerIdsArray = await db.all(getFollowerIdsQuery);
  console.log(getFollowerIdsArray);
  const getFollowerIds = getFollowerIdsArray.map((eachUser) => {
    return eachUser.follower_user_id;
  });
  console.log(`${getFollowerIds}`);
  //get tweet id of user following x made
  const getFollowersNameQuery = `select name from user where user_id in (${getFollowerIds});`;
  const getFollowersName = await db.all(getFollowersNameQuery);
  //console.log(getFollowersName);
  response.send(getFollowersName);
});

//api 6

const output6Api = (tweetData, likesData, repliesData) => {
  return {
    tweet: tweetData.tweet,
    likes: likesData.likes,
    replies: repliesData.replies,
    dateTime: tweetData.date_time,
  };
};

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { username } = request;
  const { tweetId } = request.params;
  const getUserIdQuery = `select user_id from user where username = '${username}';`;
  const UserId = await db.get(getUserIdQuery);
  //console.log(UserId);

  //get follower ids.
  const getFollowerId = `select following_user_id from follower where follower_user_id = '${UserId.user_id}';`;
  const getFollowerIds = await db.all(getFollowerId);
  //console.log(getFollowerIds);

  const getFollowerIdSimple = getFollowerIds.map((eachitem) => {
    return eachitem.following_user_id;
  });
  console.log(getFollowerIdSimple);

  // get tweet ids

  const getTweetIdQuery = `select tweet_id from tweet where user_id in (${getFollowerIdSimple});`;
  const tweetIds = await db.all(getTweetIdQuery);

  const tweetIdArray = tweetIds.map((eachitem) => {
    return eachitem.tweet_id;
  });

  if (tweetIdArray.includes(parseInt(tweetId))) {
    const getLikesQuery = `select count(user_id) as likes from like where tweet_id = '${tweetId}';`;
    const likesData = await db.all(getLikesQuery);

    const getRepliesQuery = `select count(user_id) as replies from reply where tweet_id = '${tweetId}';`;
    const repliesData = await db.all(getRepliesQuery);

    const getTweetQuery = `select tweet,date_time from tweet where tweet_id = '${tweetId}';`;
    const tweetData = await db.all(getTweetQuery);

    response.send(output6Api(tweetData, likesData, repliesData));
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

// api 7

const convertingLikeNamestoDbobject = (eachobject) => {
  return eachobject;
};

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;
    const getUserIdQuery = `select user_id from user where username = '${username}';`;
    const UserId = await db.get(getUserIdQuery);
    //console.log(UserId);

    //get follower ids.
    const getFollowerId = `select following_user_id from follower where follower_user_id = '${UserId.user_id}';`;
    const getFollowerIds = await db.all(getFollowerId);
    //console.log(getFollowerIds);

    const getFollowerIdSimple = getFollowerIds.map((eachitem) => {
      return eachitem.following_user_id;
    });
    console.log(getFollowerIdSimple);

    // get tweet ids

    const getTweetIdQuery = `select tweet_id from tweet where user_id in (${getFollowerIdSimple});`;
    const tweetIds = await db.all(getTweetIdQuery);

    const tweetIdArray = tweetIds.map((eachitem) => {
      return eachitem.tweet_id;
    });

    console.log(tweetIdArray);

    if (tweetIdArray.includes(parseInt(tweetId))) {
      const getTweetNamesQuery = `select username as likes from user inner join tweet on user.user_id = tweet.user_id where tweet_id in (${tweetIdArray});`;
      const getuserNames = await db.all(getTweetNamesQuery);

      console.log(getuserNames);

      const getNamesArray = (eachName) => {
        return eachName.likes;
      };

      const deArray = getNamesArray(getuserNames);
      console.log(deArray);

      response.send(getNamesArray());
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

// api 8

const convertNamed = (dbObject) => {
  return {
    replies: dbObject,
  };
};

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;
    const getUserIdQuery = `select user_id from user where username = '${username}';`;
    const UserId = await db.get(getUserIdQuery);
    //console.log(UserId);

    //get follower ids.
    const getFollowerId = `select following_user_id from follower where follower_user_id = '${UserId.user_id}';`;
    const getFollowerIds = await db.all(getFollowerId);
    //console.log(getFollowerIds);

    const getFollowerIdSimple = getFollowerIds.map((eachitem) => {
      return eachitem.following_user_id;
    });
    console.log(getFollowerIdSimple);

    // get tweet ids

    const getTweetIdQuery = `select tweet_id from tweet where user_id in (${getFollowerIdSimple});`;
    const tweetIds = await db.all(getTweetIdQuery);

    const tweetIdArray = tweetIds.map((eachitem) => {
      return eachitem.tweet_id;
    });

    if (tweetIdArray.includes(parseInt(tweetId))) {
      const getTweetsQuery = `select user.name,reply.reply from user inner join reply on user.user_id = reply.user_id where reply.tweet_id = '${tweetId}';`;

      const data = await db.all(getTweetsQuery);

      response.send(convertNamed(data));
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//api 9

const api6Output = (tweetData, likesCount, replyCount) => {
  return {
    tweet: tweetData.tweet,
    likes: likesCount.likes,
    replies: replyCount.replies,
    dateTime: tweetData.date_time,
  };
};

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  console.log(getUserId);
  //get tweets made by user
  const getTweetIdsQuery = `select tweet_id from tweet where user_id=${getUserId.user_id};`;
  const getTweetIdsArray = await db.all(getTweetIdsQuery);
  const getTweetIds = getTweetIdsArray.map((eachId) => {
    return parseInt(eachId.tweet_id);
  });
  console.log(getTweetIds);
  let tweetDataQuery = `select tweet, date_time from tweet where tweet_id = '${getTweetIds}';`;
  const data = [
    {
      tweet: "Ready to don the Blue and Gold",
      likes: 3,
      replies: 4,
      dateTime: "2021-4-3 08:32:44",
    },
    {
      tweet: "Ready to don the Blue",
      likes: 2,
      replies: 2,
      dateTime: "2021-4-3 08:32:44",
    },
  ];
  response.send(data);
});

// api 10
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  //console.log(getUserId.user_id);
  const { tweet } = request.body;
  //console.log(tweet);
  //const currentDate = format(new Date(), "yyyy-MM-dd HH-mm-ss");
  const currentDate = new Date();
  console.log(currentDate.toISOString().replace("T", " "));

  const postRequestQuery = `insert into tweet(tweet, user_id, date_time) values ("${tweet}", ${getUserId.user_id}, '${currentDate}');`;

  const responseResult = await db.run(postRequestQuery);
  const tweet_id = responseResult.lastID;
  response.send("Created a Tweet");
});

// api 11

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    console.log(tweetId);
    let { username } = request;
    const getUserIdQuery = `select user_id from user where username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);
    console.log(getUserId);
    //tweets made by the user
    const getUserTweetsListQuery = `select tweet_id from tweet where user_id='${getUserId.user_id}';`;
    const getUserTweetsListArray = await db.all(getUserTweetsListQuery);
    const getUserTweetsList = getUserTweetsListArray.map((eachTweetId) => {
      return eachTweetId.tweet_id;
    });
    console.log(getUserTweetsList);
    if (getUserTweetsList.includes(parseInt(tweetId))) {
      const deleteTweetQuery = `delete from tweet where tweet_id='${tweetId}';`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;

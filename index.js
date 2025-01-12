const express = require('express');
const app = express();
const cors = require('cors');
const jwt =require('jsonwebtoken');
require('dotenv').config()
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fbvkkp8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});





async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const premiumCollection = client.db("matrimony").collection("premium");
    const userCollection = client.db("matrimony").collection("users");
    const reviewCollection = client.db("matrimony").collection("reviews");
    const bioCollection = client.db("matrimony").collection("bio");
    const favouritbioCollection = client.db("matrimony").collection("addfavourits");

    // jwt
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })

       // middlewares 
       const verifyToken = (req, res, next) => {
        console.log('inside verify token', req.headers.authorization);
        if (!req.headers.authorization) {
          return res.status(401).send({ message: 'unauthorized access' });
        }
        const token = req.headers.authorization.split(' ')[1];
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
          if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
          }
          req.decoded = decoded;
          next();
        })
      }
  
    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }

    // manege user
    app.get('/users', async (req, res) => {
      const { username } = req.query;
      let query = {};
      if (username) {
        query = { name: { $regex: username, $options: 'i' } };
      }
      const users = await userCollection.find(query).toArray();
      res.send(users);
    });

    app.patch('/users/update/:email', async (req, res) => {
      const email = req.params.email
      const user = req.body
      const query = { email }
      const updateDoc = {
        $set: { ...user, timestamp: Date.now(), },
      }
      const result = await userCollection.updateOne(query, updateDoc)
      res.send(result)
    })

    // add bio data code
    app.post('/bio',async(req,res)=>{  
      const bioData = req.body;
      const result =await bioCollection.insertOne(bioData);
      res.send(result);
  })

  app.get('/bio', async(req, res) =>{
    const result = await bioCollection.find().toArray();
    res.send(result);
})

// addfavourits data code
app.post('/addfavourits',async(req,res)=>{  
  const bioData = req.body;
  const result =await favouritbioCollection.insertOne(bioData);
  res.send(result);
})

app.get('/addfavourits', async(req, res) =>{
  const result = await favouritbioCollection.find().toArray();
  res.send(result);
})

app.delete('/addfavourits/:id',async(req,res)=>{
  const id =req.params.id;
  const query={_id:new ObjectId(id)}
  const result = await favouritbioCollection.deleteOne(query);
  res.send(result)
})
    app.get('/premium', async(req, res) =>{
        const result = await premiumCollection.find().toArray();
        res.send(result);
    })
    
    app.get('/reviews', async(req, res) =>{
        const result = await reviewCollection.find().toArray();
        res.send(result);
    })

    app.post('/reviews',async(req,res)=>{  
      const reviews = req.body;
      const result =await reviewCollection.insertOne(reviews);
      res.send(result);
    })

    app.get('/users/admin/:email',  async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })

      
      app.get('/users/:email', async (req, res) => {
        const email = req.params.email
        const result = await userCollection.findOne({ email })
        res.send(result)
      })

    app.post('/users', async (req, res) => {
        const user = req.body;
        const query = { email: user.email }
        const existingUser = await userCollection.findOne(query);
        if (existingUser) {
          return res.send({ message: 'user already exists', insertedId: null })
        }
        const result = await userCollection.insertOne(user);
        res.send(result);
      });

      // add code 
      app.get('/biodata/:id', async (req, res) => {
        const id = req.params.id;
        const biodata = await userCollection.findOne({ _id: new ObjectId(id) });
        res.send(biodata);
      });
      
    
      
      // Request contact information
      app.post('/contact-request', async (req, res) => {
        const { userId, biodataId, email } = req.body;
        const contactRequest = {
          userId: new ObjectId(userId),
          biodataId: new ObjectId(biodataId),
          email,
          status: 'pending',
          createdAt: new Date()
        };
        const result = await userCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $push: { contactRequests: contactRequest } }
        );
        res.send(result);
      });
      // end code

        // Endpoint to get all premium approval requests
  app.get('/dashboard/approvedPremium',  async (req, res) => {
    const requests = await premiumCollection.find({ status: 'pending' }).toArray();
    res.send(requests);
  });

  // Endpoint to make a user premium
  app.post('/dashboard/makePremium',  async (req, res) => {
    const { biodataId } = req.body;
    const result = await bioCollection.updateOne(
      { _id: new ObjectId(biodataId) },
      { $set: { isPremium: true } }
    );
    res.send(result);
  });


        // Dashboard Data
    app.get('/dashboard', async (req, res) => {
      try {
        const totalBiodataCount = await bioCollection.countDocuments();
        const maleBiodataCount = await bioCollection.countDocuments({ biodataType: 'Male' });
        const femaleBiodataCount = await bioCollection.countDocuments({ biodataType: 'Female' });
        const premiumBiodataCount = await userCollection.countDocuments({ isPremium: true });
        
        // Assuming there's a revenue field in each biodata document for simplicity
        const totalRevenueData = await bioCollection.aggregate([
          { $group: { _id: null, totalRevenue: { $sum: "$revenue" } } }
        ]).toArray();
        const totalRevenue = totalRevenueData[0]?.totalRevenue || 0;

        res.send({
          totalBiodataCount,
          maleBiodataCount,
          femaleBiodataCount,
          premiumBiodataCount,
          totalRevenue
        });
      } catch (error) {
        res.status(500).send({ message: 'Error fetching dashboard data', error });
      }
    });

   

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('biyasadhi is sitting')
})

app.listen(port, () => {
    console.log(`matromony is sitting on port ${port}`);
})
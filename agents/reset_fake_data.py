from pymongo import MongoClient

client = MongoClient('mongodb+srv://scraperbot:GJqMqljz4GYBT0PU@cluster0.nz7wcxv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
db = client['ecuador_intel']

# Reset fake member counts to 0 (platform is new, no real users yet)
op = {"$set": {"members": 0, "postsToday": 0}}
r1 = db.communities.update_many({}, op)
print(f"Communities reset: {r1.modified_count}")

# Reset fake likes/comments/shares on feed items
op2 = {"$set": {"likes": 0, "comments": 0, "shares": 0}}
r2 = db.feed_items.update_many({}, op2)
print(f"Feed items reset: {r2.modified_count}")

# Reset fake views/likes on reels
op3 = {"$set": {"likes": 0, "comments": 0, "shares": 0, "views": 0}}
r3 = db.reels.update_many({}, op3)
print(f"Reels reset: {r3.modified_count}")

client.close()
print("Done - all fake engagement numbers reset to 0")

import { Query, ID} from 'appwrite';
import { INewPost, INewUser, IUpdatePost, IUpdateUser } from "@/types";
import { account, appwriteConfig, avatars, databases, storage } from "./config";

export async function createUserAccount(user: INewUser) {
  try {
    const newAccount = await account.create(
      ID.unique(),
      user.email,
      user.password,
      user.name
    );

    if (!newAccount) throw Error;

    const avatarUrl = avatars.getInitials(user.name);

    const newUser = await saveUserToDB({
      accountId: newAccount.$id,
      name: newAccount.name,
      email: newAccount.email,
      username: user.username,
      imageUrl: avatarUrl,
    });

    return newUser;
  } catch (error) {
    console.log(error);
    return error;
  }
}


export async function saveUserToDB(user: {
    accountId: string;
    email: string;
    name: string;
    imageUrl: string;
    username: string;
}) {
    try {
        const newUser = await databases.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.userCollectionId,
            ID.unique(),
            user,
        )

        return(newUser);
    } catch (error) {
        console.log(error);
    }
}

export async function signInAccount(user: { email: string; password: string }) {
    try {
        // Try fetching current session
        try {
            const currentSession = await account.getSession('current');
            if (currentSession) {
                console.log("User is already logged in:", currentSession);
                return currentSession;
            }
        } catch (error) {
            console.log("No active session found, proceeding with login.");
        }

        // Proceed with login
        const session = await account.createEmailPasswordSession(user.email, user.password);
        console.log("New session created:", session);
        return session;
    } catch (error) {
        console.error("Error signing in:", error);
    }
}

export async function getCurrentUser() {
    try {
        const currentAccount = await account.get();
        if(!currentAccount) throw Error;

        const currentUser = await databases.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.userCollectionId,
            [Query.equal('accountId', currentAccount.$id)],
        )

        if(!currentUser) throw Error;

        return currentUser.documents[0];
    } catch (error) {
        console.log(error);
    }
}

export async function signOutAccount() {
    try {
        const session = await account.deleteSession("current");
        return session;
    } catch (error) {
        console.log(error);
    }
}

export async function createPost(post: INewPost) {
    try {
        console.log("Sending post data:", post);
      // Upload file to appwrite storage
      const uploadedFile = await uploadFile(post.file[0]);
  
      if (!uploadedFile) throw Error;
  
      // Get file url
      const fileUrl = await getFileUrl(uploadedFile.$id);

      console.log({fileUrl})
      if (!fileUrl) {
        await deleteFile(uploadedFile.$id);
        throw Error;
      }
  
      // Convert tags into array
      const tags = post.tags?.replace(/ /g, "").split(",") || [];
  
      // Create post
      const newPost = await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.postCollectionId,
        ID.unique(),
        {
          creator: post.userId,
          caption: post.caption,
          imageUrl: fileUrl,
          imageId: uploadedFile.$id,
          location: post.location,
          tags: tags,
        }
      );
  
      if (!newPost) {
        await deleteFile(uploadedFile.$id);
        throw Error;
      }
  
      return newPost;
    } catch (error) {
      console.log(error);
    }
  }

  export async function uploadFile(file: File) {
    try {
      const uploadedFile = await storage.createFile(
        appwriteConfig.storageId,
        ID.unique(),
        file
      );
  
      return uploadedFile;
    } catch (error) {
      console.log(error);
    }
  }

  export function getFileUrl(fileId: string) {
    try {
      const fileUrl = storage.getFileView(
        appwriteConfig.storageId,
        fileId,

      );
  
      if (!fileUrl) throw Error;
  
      return fileUrl;
    } catch (error) {
      console.log(error);
    }
  }

  export async function deleteFile(fileId: string) {
    try {
      await storage.deleteFile(appwriteConfig.storageId, fileId);
  
      return { status: "ok" };
    } catch (error) {
      console.log(error);
    }
  }


  export async function getRecentPosts() {
    try {
      const posts = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.postCollectionId,
        [Query.orderDesc("$createdAt"), Query.limit(20)]
      );
  
      if (!posts) throw Error;
  
      return posts;
    } catch (error) {
      console.log(error);
    }
  }

  export async function likePost(postId: string, likesArray:string[]) {
    try {
        const updatedPost = await databases.updateDocument(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            postId,
            {
                likes: likesArray,
            }
        )

        if(!updatedPost) throw Error;

        return updatedPost;
    } catch (error) {
        console.log(error);
    }
  }

  export async function savePost(postId: string, userId:string) {
    try {
        const updatedPost = await databases.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.savesCollectionId,
            ID.unique(),
            {
                user: userId,
                post: postId,
            }
        )

        if(!updatedPost) throw Error;

        return updatedPost;
    } catch (error) {
        console.log(error);
    }
  }

  export async function deleteSavedPost(savedRecordId: string) {
    try {
        const statusCode = await databases.deleteDocument(
            appwriteConfig.databaseId,
            appwriteConfig.savesCollectionId,
            savedRecordId,
        )

        if(!statusCode) throw Error;

        return {status: 'ok'};
    } catch (error) {
        console.log(error);
    }
  }

  export async function getPostById(postId?: string) {
    if (!postId) throw Error;
  
    try {
      const post = await databases.getDocument(
        appwriteConfig.databaseId,
        appwriteConfig.postCollectionId,
        postId
      );
  
      if (!post) throw Error;
  
      return post;
    } catch (error) {
      console.log(error);
    }
  }

  export async function updatePost(post: IUpdatePost) {
    const hasFileToUpdate = post.file.length > 0;
  
    try {
      let image = {
        imageUrl: new URL(post?.imageUrl),
        imageId: post.imageId,
      };
  
      if (hasFileToUpdate) {
        // Upload new file to appwrite storage
        const uploadedFile = await uploadFile(post.file[0]);
        if (!uploadedFile) throw new Error("File upload failed.");
  
        // Get new file url
        const fileUrl = getFileUrl(uploadedFile.$id);
        if (!fileUrl) {
          await deleteFile(uploadedFile.$id);
          throw new Error("Failed to retrieve file URL.");
        }
  
        image = { ...image, imageUrl: new URL(fileUrl), imageId: uploadedFile.$id };
      }
  
      // Convert tags into array
      const tags = post.tags?.replace(/ /g, "").split(",") || [];
  
      //  Update post
      const updatedPost = await databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.postCollectionId,
        post.postId,
        {
          caption: post.caption,
          imageUrl: image.imageUrl.toString(), // Convert URL to string before saving
          imageId: image.imageId,
          location: post.location,
          tags: tags,
        }
      );
  
      if (!updatedPost) {
        throw new Error("Failed to update post.");
      }
  
      // Safely delete old file after successful update
      if (hasFileToUpdate) {
        await deleteFile(post.imageId);
      }
  
      return updatedPost;
    } catch (error) {
      console.error("Error updating post:", error);
      throw error; // Ensure the error is properly passed up
    }
  }
  

  export async function deletePost(postId?: string, imageId?: string) {
    if (!postId || !imageId) return;
  
    try {
      const statusCode = await databases.deleteDocument(
        appwriteConfig.databaseId,
        appwriteConfig.postCollectionId,
        postId
      );
  
      if (!statusCode) throw Error;
  
      await deleteFile(imageId);
  
      return { status: "Ok" };
    } catch (error) {
      console.log(error);
    }
  }

  export async function getInfinitePosts({ pageParam }: { pageParam?: string }) {
    const queries: any[] = [Query.orderDesc("$updatedAt"), Query.limit(10)];
  
    if (pageParam) {
      queries.push(Query.cursorAfter(pageParam)); // No need to convert to string
    }
  
    try {
      const posts = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.postCollectionId,
        queries
      );
  
      if (!posts) throw new Error("Failed to fetch posts");
  
      return posts;
    } catch (error) {
      console.error("Error fetching posts:", error);
      return null;
    }
  }
  

  export async function searchPosts(searchTerm: string) {
    try {
      const posts = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.postCollectionId,
        [Query.search("caption", searchTerm)]
      );
  
      if (!posts) throw Error;
  
      return posts;
    } catch (error) {
      console.log(error);
    }
  }
  

  export async function getUsers(limit?: number) {
    const queries: any[] = [Query.orderDesc("$createdAt")];
  
    if (limit) {
      queries.push(Query.limit(limit));
    }
  
    try {
      const users = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.userCollectionId,
        queries
      );
  
      if (!users) throw Error;
  
      return users;
    } catch (error) {
      console.log(error);
    }
  }
  
  // ============================== GET USER BY ID
  export async function getUserById(userId: string) {
    try {
      const user = await databases.getDocument(
        appwriteConfig.databaseId,
        appwriteConfig.userCollectionId,
        userId
      );
  
      if (!user) throw Error;
  
      return user;
    } catch (error) {
      console.log(error);
    }
  }
  
  // ============================== UPDATE USER
  export async function updateUser(user: IUpdateUser) {
    const hasFileToUpdate = user.file.length > 0;
    try {
      let image = {
        imageUrl: user.imageUrl,
        imageId: user.imageId,
      };
  
      if (hasFileToUpdate) {
        // Upload new file to appwrite storage
        const uploadedFile = await uploadFile(user.file[0]);
        if (!uploadedFile) throw Error;
  
        // Get new file url
        const fileUrl = getFileUrl(uploadedFile.$id);
        if (!fileUrl) {
          await deleteFile(uploadedFile.$id);
          throw Error;
        }
  
        image = { ...image, imageUrl: fileUrl, imageId: uploadedFile.$id };
      }
  
      //  Update user
      const updatedUser = await databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.userCollectionId,
        user.userId,
        {
          name: user.name,
          bio: user.bio,
          imageUrl: image.imageUrl,
          imageId: image.imageId,
        }
      );
  
      // Failed to update
      if (!updatedUser) {
        // Delete new file that has been recently uploaded
        if (hasFileToUpdate) {
          await deleteFile(image.imageId);
        }
        // If no new file uploaded, just throw error
        throw Error;
      }
  
      // Safely delete old file after successful update
      if (user.imageId && hasFileToUpdate) {
        await deleteFile(user.imageId);
      }
  
      return updatedUser;
    } catch (error) {
      console.log(error);
    }
  }


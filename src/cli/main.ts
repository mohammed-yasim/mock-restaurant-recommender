import chalk from 'chalk';
import readline from 'readline';
import {
    getDB,
    ensureUser,
    getAllUsers as dbGetAllUsers,
    getUserById as dbGetUserById,
} from '../db/setup';

import type { User } from '../common/types'; 

// Import the specific CLIs
import { runRestaurantCLI } from './restaurant';
import { runMovieCLI } from './movie';
import { runTvShowCLI } from './tvShow';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (query: string): Promise<string> => new Promise(resolve => rl.question(query, resolve));

let currentUser: User | undefined;

async function selectOrRegisterUser(): Promise<User | undefined> {
    console.log(chalk.cyan("\n--- User Selection ---"));
    const existingUsers = await dbGetAllUsers();

    if (existingUsers.length > 0) {
        console.log("Existing users:");
        existingUsers.forEach(u => console.log(`  ${u.id}. ${u.name}`));
    } else {
        console.log(chalk.yellow("No existing users found."));
    }
    console.log("\nN. Create New User");
    console.log("0. Exit Application");

    const choice = (await ask(chalk.green("Select user by ID, 'N' for new, or '0' to exit: "))).trim();

    if (choice.toLowerCase() === 'n') {
        const newName = (await ask(chalk.green("Enter your name: "))).trim();
        if (newName) {
            // Check if user already exists by name before creating
            let user: User | undefined = await db.get('SELECT * FROM users WHERE name = ?', newName); // Assuming `db` is accessible or use a helper
            if (user) {
                console.log(chalk.yellow(`User "${newName}" already exists with ID ${user.id}. Selecting this user.`));
                return user;
            }
            user = await ensureUser(newName); // ensureUser should handle creation if not exists
            if (user) {
                console.log(chalk.greenBright(`Welcome, ${user.name}! User created with ID ${user.id}.`));
                return user;
            } else {
                console.log(chalk.red("Failed to create user."));
                return selectOrRegisterUser(); // Try again
            }
        } else {
            console.log(chalk.yellow("Name cannot be empty."));
            return selectOrRegisterUser(); // Try again
        }
    } else if (choice === '0') {
        return undefined; // Signal to exit application
    } else {
        const userId = parseInt(choice);
        if (!isNaN(userId) && userId > 0) {
            const user = await dbGetUserById(userId);
            if (user) {
                console.log(chalk.blue(`Welcome back, ${user.name}!`));
                return user;
            } else {
                console.log(chalk.red(`User with ID ${userId} not found.`));
                return selectOrRegisterUser(); // Try again
            }
        } else {
            console.log(chalk.red("Invalid selection. Please enter a valid ID, 'N', or '0'."));
            return selectOrRegisterUser(); // Try again
        }
    }
}

// A small helper to get the DB instance for the check in selectOrRegisterUser
// This assumes getDB is exported from setup.ts

let db: any; // To hold DB instance for the check


export async function runMainCLI(): Promise<void> {
    console.log(chalk.bold.cyan("🌟 Welcome to the Recommender System! 🌟"));
    
    db = await getDB(); // Initialize db instance for the check in selectOrRegisterUser

    currentUser = await selectOrRegisterUser();

    if (!currentUser) {
        console.log(chalk.bold.magenta("\nExiting application. Goodbye! 👋"));
        rl.close();
        return;
    }

    let exitApp = false;
    while (!exitApp && currentUser) { // Loop as long as we have a current user and haven't chosen to exit
        console.log(chalk.bold.yellow("\n--- Main Menu ---"));
        console.log(chalk.gray(`👤 Current User: ${currentUser.name} (ID: ${currentUser.id})`));
        console.log("1. 🍔 Restaurant Recommender");
        console.log("2. 🎬 Movie Recommender");
        console.log("3. 📺 TV Show Recommender");
        console.log("-------------------------");
        console.log("9. 🔄 Change User");
        console.log("0. 🚪 Exit Application");

        const choice = (await ask(chalk.green("Choose an option: "))).trim();

        switch (choice) {
            case '1':
                await runRestaurantCLI(currentUser);
                break;
            case '2':
                await runMovieCLI(currentUser);
                break;
            case '3':
                await runTvShowCLI(currentUser);
                break;
            case '9':
                console.log(chalk.blue("\nChanging user..."));
                currentUser = await selectOrRegisterUser();
                if (!currentUser) { // If user chose '0' (Exit Application) from selectOrRegisterUser
                    exitApp = true;
                }
                break;
            case '0':
                exitApp = true;
                break;
            default:
                console.log(chalk.red("Invalid option. Please try again."));
        }
    }

    console.log(chalk.bold.magenta("\nExiting application. Goodbye! 👋"));
    rl.close();
}
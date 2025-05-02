const { Portfolio, Asset, sequelize } = require('../models');

async function addDummyPortfolio() {
  try {
    console.log('Adding dummy portfolio assets...');
    
    // Get all assets from the database
    const assets = await Asset.findAll();
    
    if (assets.length === 0) {
      console.error('No assets found in the database. Please add assets first.');
      return;
    }
    
    console.log(`Found ${assets.length} assets in the database.`);
    
    // Add dummy portfolio entries for user ID 1 (or change as needed)
    const userId = 3; // Change this to the user ID you want to add assets for
    
    // Create dummy portfolio entries
    const portfolioEntries = [
      {
        userId,
        assetId: assets[0].id,
        quantity: 0.5,
        average_price: assets[0].current_price * 0.95 // Slightly below current price
      },
      {
        userId,
        assetId: assets.length > 1 ? assets[1].id : assets[0].id,
        quantity: 10,
        average_price: assets.length > 1 ? assets[1].current_price * 0.98 : assets[0].current_price * 0.98
      },
      {
        userId,
        assetId: assets.length > 2 ? assets[2].id : assets[0].id,
        quantity: 25,
        average_price: assets.length > 2 ? assets[2].current_price * 0.97 : assets[0].current_price * 0.97
      }
    ];
    
    // Use a transaction to ensure all operations succeed or fail together
    const transaction = await sequelize.transaction();
    
    try {
      // For each entry, check if it already exists and update or create as needed
      for (const entry of portfolioEntries) {
        const [portfolio, created] = await Portfolio.findOrCreate({
          where: {
            userId: entry.userId,
            assetId: entry.assetId
          },
          defaults: entry,
          transaction
        });
        
        if (!created) {
          // If the portfolio entry already exists, update it
          await portfolio.update({
            quantity: entry.quantity,
            average_price: entry.average_price
          }, { transaction });
          console.log(`Updated portfolio entry for user ${userId}, asset ${entry.assetId}`);
        } else {
          console.log(`Created new portfolio entry for user ${userId}, asset ${entry.assetId}`);
        }
      }
      
      // Commit the transaction
      await transaction.commit();
      console.log('Dummy portfolio assets added successfully!');
    } catch (error) {
      // Rollback the transaction if there's an error
      await transaction.rollback();
      console.error('Error adding dummy portfolio assets:', error);
    }
  } catch (error) {
    console.error('Error in addDummyPortfolio:', error);
  } finally {
    // Close the database connection
    await sequelize.close();
  }
}

// Run the function
addDummyPortfolio()
  .then(() => {
    console.log('Script completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });

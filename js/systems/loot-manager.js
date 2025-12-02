/**
 * LootManager - Handles loot drops from enemies
 */
class LootManager {
  static materials = null;
  static items = null;

  /**
   * Initialize the LootManager by loading item/material databases
   */
  static async init() {
    try {
      // Load materials
      const materialsResponse = await fetch('data/materials.json');
      const materialsData = await materialsResponse.json();
      this.materials = materialsData.materials;

      // Load items
      const itemsResponse = await fetch('data/items.json');
      const itemsData = await itemsResponse.json();
      this.items = itemsData.items;

      // Initialized successfully
    } catch (error) {
      console.error('LootManager: Failed to initialize', error);
    }
  }

  /**
   * Roll loot drops from an enemy's loot table
   * @param {Object} enemy - The enemy object with a loot table
   * @returns {Array} Array of loot items with { itemId, quantity }
   */
  static rollLoot(enemy) {
    if (!enemy || !enemy.loot || enemy.loot.length === 0) {
      return [];
    }

    const drops = [];

    for (const lootEntry of enemy.loot) {
      // Roll for drop chance
      if (Math.random() <= lootEntry.chance) {
        // Determine quantity
        const quantity = this.rollQuantity(
          lootEntry.quantity.min,
          lootEntry.quantity.max
        );

        drops.push({
          itemId: lootEntry.itemId,
          quantity: quantity
        });
      }
    }

    return drops;
  }

  /**
   * Roll a random quantity between min and max (inclusive)
   * @param {number} min - Minimum quantity
   * @param {number} max - Maximum quantity
   * @returns {number} Random quantity
   */
  static rollQuantity(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Add loot drops to the player's inventory and log them
   * @param {Array} drops - Array of loot items with { itemId, quantity }
   */
  static processDrops(drops) {
    if (!drops || drops.length === 0) {
      if (window.ActivityLog) {
        ActivityLog.addMessage("No loot dropped.", "loot");
      }
      return;
    }

    // Don't add a header for loot, just list the items

    const character = window.GameState?.getState()?.character;
    if (!character || !character.inventory) {
      console.error('LootManager: No character or inventory found');
      return;
    }

    for (const drop of drops) {
      // Get the full item/material object
      const itemData = this.getItemData(drop.itemId);
      if (!itemData) {
        console.warn(`LootManager: Item ${drop.itemId} not found in database`);
        continue;
      }

      // Add items to inventory based on quantity
      for (let i = 0; i < drop.quantity; i++) {
        // Create a copy of the item data for each instance
        const itemInstance = { ...itemData };
        window.Inventory.addItem(character.inventory, itemInstance);
      }

      // Log the acquisition
      const quantityText = drop.quantity > 1 ? ` x${drop.quantity}` : "";
      if (window.ActivityLog) {
        ActivityLog.addMessage(`Looted ${itemData.name}${quantityText}`, "loot");
      }
    }

    // Save the game state after adding loot
    if (window.SaveSystem) {
      SaveSystem.save();
    }
  }

  /**
   * Get the full item or material data object
   * @param {string} itemId - The item/material ID
   * @returns {Object|null} The item/material data or null
   */
  static getItemData(itemId) {
    // Check materials first
    if (this.materials) {
      const material = this.materials.find(m => m.id === itemId);
      if (material) {
        return material;
      }
    }

    // Check items
    if (this.items) {
      const item = this.items.find(i => i.id === itemId);
      if (item) {
        return item;
      }
    }

    return null;
  }

  /**
   * Roll and process loot from an enemy (convenience method)
   * @param {Object} enemy - The enemy object
   */
  static handleEnemyLoot(enemy) {
    const drops = this.rollLoot(enemy);
    this.processDrops(drops);
  }
}

// Make globally available
window.LootManager = LootManager;

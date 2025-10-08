import { EffectTypes } from "@minecraft/server"
const effects = [
    "absorption",
    "bad_omen",
    "blindness",
    "conduit_power",
    "darkness",
    "fatal_poison",
    "fire_resistance",
    "haste",
    "health_boost",
    "hunger",
    "infested",
    "instant_damage",
    "instant_health",
    "invisibility",
    "mining_fatigue",
    "nausea",
    "night_vision",
    "poison",
    "raid_omen",
    "regeneration",
    "resistance",
    "saturation",
    "slow_falling",
    "slowness",
    "speed",
    "village_hero",
    "strength",
    "water_breathing",
    "weakness",
    "wither",
    "wind_charged",
];
const negativeEffects = [
    'hunger',
    'darkness',
    'blindness',
    'fatal_poison',
    'mining_fatigue',
    'nausea',
    'poison',
    'slowness',
    'wither',
    'weakness'
];
export function getAllEffects() {
    return EffectTypes.getAll();
}
export function hasEquipmentInSpecificSlots() {

}
export function spawnEntitiesAround(player, count, entityType, range) {
    const location = player.location;
    const dimension = player.dimension;

    for (let i = 0; i < count; i++) {
        const offsetX = (Math.random() * 2 - 1) * range; // Valor entre -range y range
        const offsetZ = (Math.random() * 2 - 1) * range; // Valor entre -range y range
        const spawnLocation = {
            x: location.x + offsetX,
            y: location.y,
            z: location.z + offsetZ
        };

        let entity = dimension.spawnEntity(entityType, spawnLocation)
    }
}
/**
 * Shoots a projectile in a given direction from a specific location.
 *
 * @param {string} projectileId - The ID of the projectile to spawn (e.g., "minecraft:arrow").
 * @param {import('@minecraft/server').Dimension} dimension - The dimension in which to spawn the projectile.
 * @param {import('@minecraft/server').Vector3} location - The starting position of the projectile.
 * @param {import('@minecraft/server').Vector3} direction - The direction vector the projectile will travel.
 * @param {Object} options - Additional options for projectile behavior.
 * @param {import('@minecraft/server').Entity} [options.source] - The entity that owns or fires the projectile.
 * @param {number} [options.velocityMultiplier=1] - Multiplier applied to the direction vector to set projectile speed.
 * @param {number} [options.uncertainty=0] - Adds random deviation to the projectile's trajectory (spread).
 */
export function shootProjectile(projectileId, dimension, location, direction, { source, velocityMultiplier = 1, uncertainty = 0 }) {
    const velocity = {
        x: direction.x * velocityMultiplier,
        y: direction.y * velocityMultiplier,
        z: direction.z * velocityMultiplier,
    };

    const projectile = dimension.spawnEntity(projectileId, location);
    const projectileComp = projectile.getComponent('minecraft:projectile');

    projectileComp?.shoot(velocity, {
        uncertainty,
    });

    if (source) {
        projectileComp.owner = source;
    }
}


export function hasEquipmentSlot(player, itemID, slot) {
    let getEquipment = player.getComponent('equippable').getEquipment(slot)
    if (getEquipment?.typeId == itemID) {
        return true;
    }
}

export function hasItem(player, itemId) {
    let inventory = player.getComponent("inventory");
    if (!inventory) {
        return false;
    }
    let container = inventory.container;
    for (let i = 0; i < container.size; i++) {
        let item = container.getItem(i);
        if (item?.typeId == itemId) {
            return true;
        }
    }
    return false;
}

export function clearMainhandItem(player) {
    if (player.matches({ gameMode: `Creative` })) return
    player.getComponent("equippable").setEquipment("Mainhand", undefined)
}

export function updateItemAmount(item, player) {
    if (player.matches({ gameMode: `Creative` })) return

    let equippable = player.getComponent("equippable")
    if (item.amount == 1) {
        equippable.setEquipment("Mainhand", undefined)
        return
    }
    item.amount -= 1
    equippable.setEquipment('Mainhand', item)
}

export function updateItemDurability(source, item, durabilityModifier = 1) {
    if (source.matches({ gameMode: `Creative` })) return

    const equippable = source.getComponent("equippable");
    const durability = item.getComponent("durability");

    durability.damage += durabilityModifier;

    const maxDurability = durability.maxDurability
    const currentDamage = durability.damage
    if (currentDamage >= maxDurability) {

        source.playSound('random.break', { pitch: 1, location: source.location, volume: 1 })
        equippable.setEquipment("Mainhand", undefined);
    }
    else {

        equippable.setEquipment("Mainhand", item);
    }
}

/* 
export function teleportPlayer(source) {
    let block = source.dimension.getBlockBelow(source.location, {
        includeLiquidBlocks: true,
    });
    let { x, y, z } = block.location;
    source.teleport({
        x: Math.floor(x) + 0.5,
        y: y + 0.5,
        z: Math.floor(z) + 0.5,
    });
}
 */
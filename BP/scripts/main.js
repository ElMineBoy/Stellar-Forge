import { world, system, ItemStack, EquipmentSlot } from "@minecraft/server";

import "item_components.js"


function parseOre(id) {
    const [namespace, name] = id.split(":");
    if (!name) return id; // Si no tiene nombre, devolvemos tal cual

    // Si es un ore (incluyendo deepslate), convertir a raw_<base>
    const oreMatch = name.match(/^(deepslate_)?(.+)_ore$/);
    if (oreMatch) {
        const base = oreMatch[2];
        return `${namespace}:raw_${base}`;
    }

    // Si es un raw_<base>, convertir a <base>_ingot
    if (name.startsWith("raw_")) {
        const base = name.replace(/^raw_/, "");
        return `${namespace}:${base}_ingot`;
    }

    //return id
    return "unknown";
}


function shootProjectile(projectileId, dimension, location, direction, { source, velocityMultiplier = 1, uncertainty = 0 }) {
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


const NEONITE_PICKAXE_ID = "stellar:neonite_pickaxe";

world.afterEvents.playerBreakBlock.subscribe(event => {
    const player = event.player;
    const block = event.brokenBlockPermutation;
    const equippable = player.getComponent("minecraft:equippable");
    const item = player.getComponent("minecraft:equippable").getEquipment("Mainhand");
    const block1 = event.block;


    if (!item || item.typeId !== NEONITE_PICKAXE_ID) return;

    const blockId = block.type.id;
    let smeltResultId = null;

    if (blockId === "minecraft:iron_ore" || blockId === "minecraft:deepslate_iron_ore") {
        smeltResultId = "minecraft:iron_ingot";
    } else if (blockId === "minecraft:gold_ore" || blockId === "minecraft:deepslate_gold_ore") {
        smeltResultId = "minecraft:gold_ingot";
    } else if (blockId === "minecraft:copper_ore" || blockId === "minecraft:deepslate_copper_ore") {
        smeltResultId = "minecraft:copper_ingot";
    }

    if (smeltResultId) {
        // Dar el lingote directamente al jugador


        const dimension = player.dimension;
        const oreItems = dimension.getEntities({ type: "minecraft:item", location: block1.location, maxDistance: 1.5 })

        oreItems.forEach(oreItem => {
            const rawOre = oreItem.getComponent("item").itemStack
            //aqui validamos si existe un ore crudo del bloque minado

            //world.sendMessage(parseOre(blockOre) + " " + rawOre.typeId)
            if (parseOre(block.type.id) != rawOre.typeId) { return; }
            const ingotOre = new ItemStack(parseOre(rawOre.typeId))

            dimension.spawnItem(ingotOre, oreItem.location)
            oreItem.remove()

            //console.warn(rawOre.typeId)
        })

        // ✨ Partículas + 🔊 Sonido
        const { x, y, z } = event.block.location;
        system.runTimeout(() => {
            player.runCommand(`particle minecraft:endrod ${x} ${y + 1} ${z}`);
            player.runCommand(`particle minecraft:enchanting_table_particle ${x} ${y + 0.5} ${z}`);
            player.runCommand(`playsound random.anvil_use @a ${x} ${y} ${z} 1 1.2`);
        }, 2);
    }
});


const NEONITE_SWORD_ID = "stellar:neonite_sword";

const SPECIAL_COOLDOWN = 5000; // ⏳ 5 segundos de cooldown
const DASH_FORCE = 2.5;       // 🚀 Velocidad del dash
const ATTACK_RADIUS = 3;      // 📍 Radio de daño en el dash
const DASH_DAMAGE = 10;       // 💥 Daño que hace el dash
const playerCooldowns = new Map();


world.afterEvents.entityHitEntity.subscribe(event => {
    const player1 = event.damagingEntity;
    const target1 = event.hitEntity;

    // Verificamos que el atacante es jugador
    if (!player1?.getComponent) return;

    const item = player1.getComponent("minecraft:equippable")?.getEquipment("Mainhand");
    if (!item || item.typeId !== NEONITE_SWORD_ID) return;

    // ✨ Partículas futuristas al golpear

    // 💪 Efecto al jugador (fuerza + velocidad breve)

    player1.addEffect("strength", 40, { amplifier: 3, showParticles: false });
    player1.addEffect("speed", 40, { amplifier: 2, showParticles: false });
});


world.beforeEvents.itemUse.subscribe(event => {
    const player = event.source;
    const item = event.itemStack;

    if (!item || item.typeId !== NEONITE_SWORD_ID) return;

    const now = Date.now();
    const lastUse = playerCooldowns.get(player.id) || 0;

    if (now - lastUse < SPECIAL_COOLDOWN) {
        const secondsLeft = ((SPECIAL_COOLDOWN - (now - lastUse)) / 1000).toFixed(1);
        player.sendMessage(`§c⚠ Ataque especial disponible en ${secondsLeft}s`);
        return;
    }

    playerCooldowns.set(player.id, now);

    // 📍 Dirección a donde mira el jugador
    const direction = player.getViewDirection();


    // ✨ Efectos visuales del dash
    const { x, y, z } = player.location;
    system.runTimeout(() => {
        player.runCommand(`particle minecraft:endrod ${x} ${y + 1} ${z}`);
        player.runCommand(`particle minecraft:sonic_explosion_emitter ${x} ${y + 1} ${z}`);
        player.runCommand(`playsound mob.enderdragon.flap @a ${x} ${y} ${z} 1 1.3`);
    }, 2);



    // 🚀 Empuje tipo dash (anime)

    // 💥 Daño en área frente al jugador (ligeramente después del dash)
    system.runTimeout(() => {
        const dimension = player.dimension;
        const playerPos = player.location;

        for (const entity of dimension.getEntities({ maxDistance: ATTACK_RADIUS, location: playerPos })) {
            if (entity.id !== player.id && entity.typeId !== "minecraft:item") {
                entity.applyDamage(DASH_DAMAGE, { cause: "entityAttack", damagingEntity: player });
            }
        }

        // 💪 Buff corto al jugador
        player.addEffect("strength", 60, { amplifier: 2, showParticles: false });
        player.addEffect("speed", 60, { amplifier: 2, showParticles: false });

        player.sendMessage("§b⚡ ¡Ataque especial activado!");
    }, 8); // pequeño delay para que golpee después de moverse
});


const NEONITE_ARMOR_IDS = {
    head: "stellar:neonite_armor_helmet",
    chest: "stellar:neonite_armor_chestplate",
    legs: "stellar:neonite_armor_leggings",
    feet: "stellar:neonite_armor_boots"
};

// ✨ Efectos de la armadura de Neonita
function applyNeoniteArmorEffects(player) {
    player.addEffect("strength", 40, { amplifier: 3, showParticles: false });
    player.addEffect("resistance", 40, { amplifier: 3, showParticles: false });
    player.addEffect("regeneration", 40, { amplifier: 2, showParticles: false });
    player.addEffect("speed", 40, { amplifier: 2, showParticles: false });
    player.addEffect("night_vision", 220, { amplifier: 0, showParticles: false });
    // 220 ticks = 11 s → la renovamos antes de que se acabe para evitar parpadeo
}

// 🧰 Verificar set completo
function hasFullNeoniteArmor(player) {
    const eq = player.getComponent("minecraft:equippable");
    if (!eq) return false;

    return (
        eq.getEquipment(EquipmentSlot.Head)?.typeId === NEONITE_ARMOR_IDS.head &&
        eq.getEquipment(EquipmentSlot.Chest)?.typeId === NEONITE_ARMOR_IDS.chest &&
        eq.getEquipment(EquipmentSlot.Legs)?.typeId === NEONITE_ARMOR_IDS.legs &&
        eq.getEquipment(EquipmentSlot.Feet)?.typeId === NEONITE_ARMOR_IDS.feet
    );
}

// Guardamos estado de vuelo por jugador
const flyingState = new Map(); // player.id → true/false

// 🚫 Cancelar daño por caída si lleva la armadura
world.afterEvents.entityHurt.subscribe((event) => {
    const { damageSource, hurtEntity } = event;
    if (hurtEntity.typeId !== "minecraft:player") return;
    if (damageSource.cause === "fall" && hasFullNeoniteArmor(hurtEntity)) {
        event.cancel = true;
    }
});

// 🌀 Loop principal cada 5 ticks (0.25 s)
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const fullSet = hasFullNeoniteArmor(player);

        if (!fullSet) {
            player.removeEffect("levitation");
            flyingState.delete(player.id);
            continue;
        }

        // Aplicar efectos base
        applyNeoniteArmorEffects(player);

        const isSneaking = player.isSneaking;
        const isFlying = flyingState.get(player.id) === true;

        if (isSneaking) {
            // 🧨 Al aterrizar → pequeña explosión visual
            if (isFlying) {
                const { x, y, z } = player.location;
                system.runTimeout(() => {
                    player.runCommand(`particle minecraft:sonic_explosion_emitter ${x} ${y} ${z}`);
                    player.runCommand(`playsound random.explode @a ${x} ${y} ${z} 1 1.5`);
                }, 1);

                player.removeEffect("levitation");
                flyingState.set(player.id, false);
            }
        } else {
            // 🕊 Activar vuelo + 🌟 estela luminosa
            player.addEffect("levitation", 60, { amplifier: 1, showParticles: false });
            flyingState.set(player.id, true);

            const { x, y, z } = player.location;
            player.runCommand(`particle minecraft:endrod ${x} ${y - 0.5} ${z}`);
            player.runCommand(`particle minecraft:enchanting_table_particle ${x} ${y - 0.2} ${z}`);
        }
    }
}, 5);







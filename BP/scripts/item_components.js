import { system, world } from '@minecraft/server';
import { shootProjectile } from "utils/functions.js"

system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {

    itemComponentRegistry.registerCustomComponent('eu:consume_effects', {
        onConsume(ev, arg) {
            const { source } = ev;
            const params = arg.params;

            for (const { name, duration, amplifier = 0, showParticles = true } of params) {
                source.addEffect(name, duration, { amplifier, showParticles });
            }
        }
    });
    itemComponentRegistry.registerCustomComponent('eu:consume_clear_effects', {
        onConsume(ev, arg) {
            const { source } = ev;
            const {
                effects
            } = arg?.params;

            effects.forEach(effect => {
                source.removeEffect(effect)
            })
        }
    });
    itemComponentRegistry.registerCustomComponent('eu:start_use_cooldown', {
        onUse: arg => {
            const { source, itemStack } = arg
            itemStack.getComponent('cooldown').startCooldown(source);
        }
    })
    itemComponentRegistry.registerCustomComponent('eu:durability_modifiers', {
        onUse(ev, arg) {
            const { source, itemStack } = ev
            const {
                damage = 1,
                breakSound = "random.break",
                replaceItem = undefined
            } = arg?.params;
            if (source.matches({ gameMode: `Creative` })) return

            const equippable = source.getComponent("equippable");
            const durability = itemStack.getComponent("durability");
            durability.damage += damage;

            const maxDurability = durability.maxDurability
            const currentDamage = durability.damage
            if (currentDamage >= maxDurability) {
                source.playSound(breakSound, { pitch: 1, location: source.location, volume: 1 })
                equippable.setEquipment("Mainhand", replaceItem);
            }
            else {
                equippable.setEquipment("Mainhand", itemStack);
            }
        },
        onBeforeDurabilityDamage(ev) {
            ev.durabilityDamage = 0
        }
    })
    itemComponentRegistry.registerCustomComponent('eu:use_modifiers', {

        onUse(ev, arg) {
            const { source, itemStack } = ev
            const {
                sound,
                hasCooldown = false,
                particle
            } = arg?.params;
            if (sound) {
                source.dimension.playSound(sound, source.location)
            }
            if (particle) {
                source.dimension.spawnParticle(particle, source.location)
            }
            if (hasCooldown) {
                itemStack.getComponent('cooldown').startCooldown(source);
            }

        }
    })

    itemComponentRegistry.registerCustomComponent("stellar:shoot_projectile", {
        /**
         * params:
         * - projectileId: string (entity typeId, e.g. "minecraft:arrow")
         * - speed: number (velocity multiplier, default 1.5)
         * - offset: number (forward offset from head, default 0.6)
         * - count: number (how many projectiles, default 1)
         * - spread: number (random spread in degrees, default 0)
         */
        onUse(ev, arg) {
            const { source } = ev;

            const {
                projectileId = "minecraft:snowball",
                speed = 1.5,
                offset = 0.6,
                verticalOffset = 0,
                count = 1,
                spread = 0,
                uncertainty = 0
            } = arg?.params;

            const headLoc = source.getHeadLocation();
            const baseDir = source.getViewDirection();

            const normalize = (v) => {
                const mag = Math.hypot(v.x, v.y, v.z) || 1;
                return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
            };

            const dirNorm = normalize(baseDir);

            const withSpread = (dir, deg) => {
                if (!deg) return dir;
                const rad = (d) => (d * Math.PI) / 180;
                const horiz = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
                let pitch = Math.atan2(dir.y, horiz);
                let yaw = Math.atan2(dir.z, dir.x);
                pitch += rad((Math.random() * 2 - 1) * deg);
                yaw += rad((Math.random() * 2 - 1) * deg);
                const cosP = Math.cos(pitch);
                return {
                    x: Math.cos(yaw) * cosP,
                    y: Math.sin(pitch),
                    z: Math.sin(yaw) * cosP,
                };
            };

            for (let i = 0; i < count; i++) {
                const dir = withSpread(dirNorm, spread);
                const spawnPos = {
                    x: headLoc.x + dir.x * offset,
                    y: headLoc.y + dir.y * offset + verticalOffset,
                    z: headLoc.z + dir.z * offset,
                };

                shootProjectile(projectileId, source.dimension, spawnPos, dir, {
                    source: source,
                    velocityMultiplier: speed,
                    uncertainty: uncertainty
                });
            }
        }
    });
    itemComponentRegistry.registerCustomComponent("eu:spawn_entity", {
        /**
         * params:
         * - entity: string (entity typeId, e.g. "minecraft:zombie")
         * - count: number (how many entities to spawn, default 1)
         * - range: number (max horizontal spawn offset from player, default 0)
         * - spawnEvent: string (optional event to trigger on spawned entity)
         */
        onUse(ev, arg) {
            const { source } = ev;
            const {
                entity,
                count = 1,
                range = 0,
                isTamed = false,
                spawnEvent
            } = arg?.params;


            for (let i = 0; i < count; i++) {
                const basePos = source.location;

                // Random horizontal offset
                const offsetX = (Math.random() * 2 - 1) * range;
                const offsetZ = (Math.random() * 2 - 1) * range;

                const spawnPos = {
                    x: basePos.x + offsetX,
                    y: basePos.y,
                    z: basePos.z + offsetZ,
                };

                const spawned = source.dimension.spawnEntity(entity, spawnPos);

                if (spawnEvent && spawned?.triggerEvent) {
                    spawned.triggerEvent(spawnEvent);
                }
                if (isTamed) {
                    spawned.getComponent('tameable').tame(source)
                }
            }
        },
    });

    /*
    "eu:on_damage": {
        "target": {
            "addEffects": [
                {
                    "name": "blindness",
                    "duration": 60,
                    "showParticles": false
                }
            ]
        },
        "attacker": {
            "addEffects": [
                {
                    "name": "blindness",
                    "duration": 60,
                    "showParticles": false
                }
            ]
        }
    },
     */
    itemComponentRegistry.registerCustomComponent("eu:on_damage", {

        onHitEntity(ev, arg) {
            const { hitEntity, attackingEntity } = ev;

            const {
                target,
                attacker,
            } = arg?.params;

            const targetEffects = target.addEffects || [];
            const attackerEffects = attacker.addEffects || [];

            const applyEffects = (entity, list) => {
                for (const effect of list) {
                    const {
                        name,
                        duration,
                        amplifier = 0,
                        showParticles = true
                    } = effect
                    entity.addEffect(name, duration, { amplifier: amplifier, showParticles: showParticles });
                }
            };

            if (target) {
                applyEffects(hitEntity, targetEffects);
            }
            if (attacker) {
                applyEffects(attackingEntity, attackerEffects);
            }
        }
    });

    //meneja la durabilidad de una herramienta al romper un bloque
    itemComponentRegistry.registerCustomComponent('eu:generic_tool', {
        onMineBlock(ev) {
            const { source } = ev
            const equippable = source.getComponent("minecraft:equippable");

            const mainhand = equippable.getEquipmentSlot("Mainhand");
            if (!mainhand.hasItem()) return;

            if (source.getGameMode() == "Creative") return;

            const itemStack = mainhand.getItem(); // Allows us to get item components

            const durability = itemStack.getComponent("minecraft:durability");
            if (!durability) return;

            // Factor in unbreaking enchantment
            const enchantable = itemStack.getComponent("minecraft:enchantable");
            const unbreakingLevel = enchantable?.getEnchantment("unbreaking")?.level;

            const damageChance = durability.getDamageChance(unbreakingLevel) / 100;

            if (Math.random() > damageChance) return; // Randomly skip damage based on unbreaking level

            // Damage the item
            const shouldBreak = durability.damage == durability.maxDurability;

            if (shouldBreak) {
                mainhand.setItem(undefined); // Remove the item
                source.playSound("random.break"); // Play break sound
            } else {
                durability.damage++; // Increase durability damage
                mainhand.setItem(itemStack); // Update item in main hand
            }
        }
    });
});

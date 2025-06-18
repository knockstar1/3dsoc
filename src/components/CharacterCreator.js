class CharacterCreator {
    constructor(scene) {
        this.scene = scene;
        this.character = null;
        this.currentPart = 'head';
        this.variations = {
            head: 0,
            teeth: 0,
            shirt: 0,
            belt: 0,
            pants: 0,
            shoes: 0
        };
        this.colors = {
            head: 0xffcc99,
            teeth: 0xffffff,
            shirt: 0x0000ff,
            belt: 0x000000,
            pants: 0x000080,
            shoes: 0x222222
        };
        this.token = localStorage.getItem('token');
        this.userId = localStorage.getItem('userId');
    }

    async init() {
        await this.loadCharacter();
        this.createCharacter();
    }

    async loadCharacter() {
        try {
            const response = await fetch('/api/users/character', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load character');
            }

            const data = await response.json();
            this.variations = data.variations;
            this.colors = data.colors;
        } catch (error) {
            console.error('Error loading character:', error);
            // Use default values if loading fails
        }
    }

    async saveCharacter() {
        try {
            const response = await fetch('/api/users/character', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    variations: this.variations,
                    colors: this.colors
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save character');
            }

            console.log('Character saved successfully');
        } catch (error) {
            console.error('Error saving character:', error);
        }
    }

    createCharacter() {
        // Remove existing character if it exists
        if (this.character) {
            this.scene.remove(this.character);
        }

        // Create character group
        this.character = new THREE.Group();
        this.scene.add(this.character);

        // Create character parts
        this.createPart('head', 0, 1.5, 0, 0.5, 0.5, 0.5);
        this.createPart('teeth', 0, 1.2, 0.3, 0.2, 0.1, 0.1);
        this.createPart('shirt', 0, 0.8, 0, 0.4, 0.6, 0.4);
        this.createPart('belt', 0, 0.4, 0, 0.5, 0.1, 0.3);
        this.createPart('pants', 0, 0.2, 0, 0.4, 0.4, 0.3);
        this.createPart('shoes', 0, 0, 0, 0.3, 0.1, 0.4);

        // Set initial rotation
        this.character.rotation.y = Math.PI / 4;
    }

    createPart(part, x, y, z, width, height, depth) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshPhongMaterial({
            color: this.colors[part],
            shininess: 30
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        mesh.userData.part = part;
        this.character.add(mesh);
    }

    updatePart(part) {
        const mesh = this.character.children.find(child => child.userData.part === part);
        if (mesh) {
            mesh.material.color.setHex(this.colors[part]);
        }
    }

    setPart(part) {
        this.currentPart = part;
    }

    setVariation(variation) {
        this.variations[this.currentPart] = variation;
        this.saveCharacter();
    }

    setColor(color) {
        this.colors[this.currentPart] = parseInt(color.replace('#', '0x'));
        this.updatePart(this.currentPart);
        this.saveCharacter();
    }

    onWheel(event) {
        if (this.character) {
            this.character.rotation.y += event.deltaY * 0.001;
        }
    }
}

export default CharacterCreator; 
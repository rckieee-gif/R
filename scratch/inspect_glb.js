import fs from 'fs';

function inspectGlb(filePath) {
  const buffer = fs.readFileSync(filePath);
  
  // Read header
  const magic = buffer.readUInt32LE(0);
  if (magic !== 0x46546C67) {
    console.error('Not a valid GLB file');
    return;
  }
  
  const version = buffer.readUInt32LE(4);
  const totalLength = buffer.readUInt32LE(8);
  console.log(`GLB Version: ${version}, Total Length: ${totalLength} bytes`);
  
  // Read first chunk (JSON)
  const chunkLength = buffer.readUInt32LE(12);
  const chunkType = buffer.readUInt32LE(16);
  
  if (chunkType !== 0x4E4F534A) {
    console.error('First chunk is not JSON');
    return;
  }
  
  const jsonBuffer = buffer.subarray(20, 20 + chunkLength);
  const jsonString = jsonBuffer.toString('utf8');
  const gltf = JSON.parse(jsonString);
  
  console.log('\n--- Nodes in GLB ---');
  if (gltf.nodes) {
    gltf.nodes.forEach((node, index) => {
      console.log(`Node [${index}]: name="${node.name || 'unnamed'}", meshIndex=${node.mesh !== undefined ? node.mesh : 'none'}, children=${node.children ? JSON.stringify(node.children) : 'none'}`);
    });
  } else {
    console.log('No nodes found');
  }

  console.log('\n--- Meshes in GLB ---');
  if (gltf.meshes) {
    gltf.meshes.forEach((mesh, index) => {
      console.log(`Mesh [${index}]: name="${mesh.name || 'unnamed'}"`);
    });
  } else {
    console.log('No meshes found');
  }

  console.log('\n--- Materials in GLB ---');
  if (gltf.materials) {
    gltf.materials.forEach((mat, index) => {
      console.log(`Material [${index}]: name="${mat.name || 'unnamed'}"`);
    });
  } else {
    console.log('No materials found');
  }
}

inspectGlb('public/Egg.glb');

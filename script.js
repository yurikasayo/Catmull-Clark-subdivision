/**
 * GUI
 */
const GUI = lil.GUI
const gui = new GUI()
const debugObject = {}

/**
 * Base
 */
// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

// loading
const loading = document.querySelector('.loading')

/**
 * Material
 */
const material = new THREE.MeshStandardMaterial( { color: 0xccffff } )
const lineMaterial = new THREE.MeshBasicMaterial( { color: 0x333333, wireframe: true })

/**
 * Model
 */
// loader
const loader = new THREE.FileLoader()

const loadObj = (text) => {
    const txtlines = text.split('\n')

    const vertices = []
    const normals = []
    const faceids = []
    const facenids = []

    for (let i = 0; i < txtlines.length; i++)
    {
        const txtline = txtlines[i]
        if (txtline.length == 0) continue

        const segments = txtline.split(' ')
        switch(segments[0])
        {
            case 'v':
                vertices.push(new THREE.Vector3(parseFloat(segments[1]), parseFloat(segments[2]), parseFloat(segments[3])))
                break
            
            case 'vn':
                normals.push(new THREE.Vector3(parseFloat(segments[1]), parseFloat(segments[2]), parseFloat(segments[3])))
                break

            case 'f':
                const faceid = []
                for (let j = 1; j < segments.length; j++)
                {
                    faceid.push(parseFloat(segments[j].split('/')[0])-1)
                }
                faceids.push(faceid)
                facenids.push(segments[1].split('/')[2]-1)
                break

            default:
                break
        }
    }

    return { v: vertices, n: normals, f: faceids, nf: facenids }
}


let obj;
let meshes;
let cubeObj;
let torusObj;
let suzanneObj;
loader.load('./models/cube.obj',(text) => 
    {
       const tmpObj = loadObj(text)
       cubeObj = addRelevance(tmpObj)
       obj = cubeObj
       meshes = displayObj(obj)
    }
)
loader.load('./models/torus.obj',(text) => 
    {
       const tmpObj = loadObj(text)
       torusObj = addRelevance(tmpObj)
    }
)
loader.load('./models/suzanne.obj',(text) => 
    {
       const tmpObj = loadObj(text)
       suzanneObj = addRelevance(tmpObj)
    }
)

/**
 * Subdivide
 */
 const addRelevance = (obj) => 
 {
     const lineids = []
     const line2face = []
     const face2line = []
     const vertice2line = []
     const vertice2face = []
 
     for (let i = 0; i < obj.v.length; i++)
     {
         vertice2line.push([])
         vertice2face.push([])
     }
 
     for (let i = 0; i < obj.f.length; i++) {
         const faceid = obj.f[i]
         face2line.push([])
         for (let j = 0; j < faceid.length; j++) {
             const id1 = faceid[j]
             const id2 = faceid[(j+1)%faceid.length]
             const ids = [Math.min(id1,id2),Math.max(id1,id2)]
 
             const index = lineids.findIndex(item => JSON.stringify(item) == JSON.stringify(ids))
             if (index == -1)
             {
                 lineids.push(ids)
                 line2face.push([i])
                 vertice2line[id1].push(lineids.length-1)
                 vertice2line[id2].push(lineids.length-1)
                 face2line[i].push(lineids.length-1)
             } 
             else
             {
                 line2face[index].push(i)
                 face2line[i].push(index)
             }
             
             vertice2face[id1].push(i)
         }
     }
 
     obj.l = lineids
     obj.l2f = line2face
     obj.f2l = face2line
     obj.v2l = vertice2line
     obj.v2f = vertice2face
 
     return obj
 }

const catmullClark = (obj) =>
{
    // lists
    const vertices = []
    const normals = []
    const faceids = []
    const facenids = []
    
    const verticeNormals = []
    const faceCenters = []
    const lineCenters = []

    // calculate vertices
    for (let i = 0; i < obj.f.length; i++) 
    {
        const vertice = new THREE.Vector3()
        const verticeNormal = obj.n[obj.nf[i]]
        for (let j = 0; j < obj.f[i].length; j++) 
            vertice.addScaledVector(obj.v[obj.f[i][j]], 1 / obj.f[i].length)
        faceCenters.push(vertice)
        vertices.push(vertice)
        verticeNormals.push(verticeNormal)
    }

    for (let i = 0; i < obj.l.length; i++) 
    {
        const center = new THREE.Vector3()
        for (let j = 0; j < obj.l[i].length; j++)
            center.addScaledVector(obj.v[obj.l[i][j]], 1 / obj.l[i].length)
        lineCenters.push(center)
        
        const vertice = new THREE.Vector3()
        const verticeNormal = new THREE.Vector3()
        vertice.addScaledVector(center, 0.5)
        for (let j = 0; j < obj.l2f[i].length; j++)
        {
            vertice.addScaledVector(faceCenters[obj.l2f[i][j]], 0.5 / obj.l2f[i].length)
            verticeNormal.addScaledVector(obj.n[obj.nf[obj.l2f[i][j]]], 1.0 / obj.l2f[i].length)
        }
        vertices.push(vertice)
        verticeNormals.push(verticeNormal)
    }

    for (let i = 0; i < obj.v.length; i++) 
    {
        const vertice = new THREE.Vector3()
        const verticeNormal = new THREE.Vector3()
        const n = obj.v2l[i].length
        for (let j = 0; j < obj.v2f[i].length; j++)
        {
            vertice.addScaledVector(faceCenters[obj.v2f[i][j]], 1.0 / (n * obj.v2f[i].length))
            verticeNormal.addScaledVector(obj.n[obj.nf[obj.v2f[i][j]]], 1.0 / obj.v2f[i].length)
        }
        for (let j = 0; j < obj.v2l[i].length; j++)
            vertice.addScaledVector(lineCenters[obj.v2l[i][j]], 2.0 / (n * obj.v2l[i].length))
        vertice.addScaledVector(obj.v[i], (n-3) / n)
        vertices.push(vertice)
        verticeNormals.push(verticeNormal)
    }
    
    // redefine faceIndex and normal
    for (let i = 0; i < obj.f.length; i++) 
    {
        for (let j = 0; j < obj.f[i].length; j++)
        {
            const id1 = obj.f.length + obj.l.length + obj.f[i][j]
            const id2 = obj.f.length + obj.f2l[i][j]
            const id3 = i
            const id4 = obj.f.length + obj.f2l[i][(j+obj.f2l[i].length-1)%obj.f2l[i].length]

            const normal = new THREE.Vector3()
            normal.addScaledVector(verticeNormals[id1], 0.25)
            normal.addScaledVector(verticeNormals[id2], 0.25)
            normal.addScaledVector(verticeNormals[id3], 0.25)
            normal.addScaledVector(verticeNormals[id4], 0.25)

            normals.push(normal)
            faceids.push([id1, id2, id3, id4])
            facenids.push(normals.length-1)
        }
    }

    let subdevidedObj =  { v: vertices, n: normals, f: faceids, nf: facenids }
    subdevidedObj = addRelevance(subdevidedObj)
    
    return subdevidedObj
} 

/**
 * Manipulate Models
 */

const displayObj = (obj) =>
{
    // face
    const geometry = new THREE.BufferGeometry()

    const faceNum = obj.f.length
    const vertices = []
    const normals = []
    const indices = []

    for (let i = 0; i < faceNum; i++) {
        if (obj.f[i].length == 4)
        {
            const v1 = obj.v[obj.f[i][0]]
            const v2 = obj.v[obj.f[i][1]]
            const v3 = obj.v[obj.f[i][2]]
            const v4 = obj.v[obj.f[i][3]]
            const v5 = new THREE.Vector3(
                (v1.x + v2.x + v3.x + v4.x) / 4,
                (v1.y + v2.y + v3.y + v4.y) / 4,
                (v1.z + v2.z + v3.z + v4.z) / 4 
            )        
            vertices.push(v1, v2, v3, v4, v5)

            const n = obj.n[obj.nf[i]]
            normals.push(n, n, n, n, n)
            
            const verticesLength = vertices.length - 5
            indices.push(verticesLength + 0, verticesLength + 1, verticesLength + 4)
            indices.push(verticesLength + 1, verticesLength + 2, verticesLength + 4)
            indices.push(verticesLength + 2, verticesLength + 3, verticesLength + 4)
            indices.push(verticesLength + 3, verticesLength + 0, verticesLength + 4)
        }
        else
        {
            const v1 = obj.v[obj.f[i][0]]
            const v2 = obj.v[obj.f[i][1]]
            const v3 = obj.v[obj.f[i][2]]
            vertices.push(v1, v2, v3)

            const n = obj.n[obj.nf[i]]
            normals.push(n, n, n)

            const verticesLength = vertices.length - 3
            indices.push(verticesLength + 0, verticesLength + 1, verticesLength + 2)
        }
    }

    const positionAttributes = new Float32Array(vertices.length * 3)
    const normalAttributes = new Float32Array(vertices.length * 3)
    for (let i = 0; i < vertices.length; i++)
    {
        positionAttributes[i * 3 + 0] = vertices[i].x
        positionAttributes[i * 3 + 1] = vertices[i].y
        positionAttributes[i * 3 + 2] = vertices[i].z
        
        normalAttributes[i * 3 + 0] = normals[i].x
        normalAttributes[i * 3 + 1] = normals[i].y
        normalAttributes[i * 3 + 2] = normals[i].z
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positionAttributes, 3))
    geometry.setAttribute('normal', new THREE.BufferAttribute(normalAttributes, 3))
    geometry.setIndex(indices)

    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    // line
    const lineGeometry = new THREE.BufferGeometry()

    const linePositionAttributes = new Float32Array(obj.v.length * 3)
    for (let i = 0; i < obj.v.length; i++)
    {
        linePositionAttributes[i * 3 + 0] = obj.v[i].x
        linePositionAttributes[i * 3 + 1] = obj.v[i].y
        linePositionAttributes[i * 3 + 2] = obj.v[i].z
    }

    const lineIndices = []
    for (let i = 0; i < obj.l.length; i++)
    {
        lineIndices.push(obj.l[i][0],obj.l[i][0],obj.l[i][1])
    }

    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositionAttributes, 3))
    lineGeometry.setIndex(lineIndices)

    const lineMesh = new THREE.Mesh(lineGeometry, lineMaterial)
    scene.add(lineMesh)

    return {mesh, lineMesh}
}

debugObject.model = "cube"
gui.add(debugObject, 'model', ["cube", "torus", "suzanne"]).onChange(
    value =>
    {
        switch(value)
        {
            case 'cube':
                obj = cubeObj
                break

            case 'torus':
                obj = torusObj
                break

            case 'suzanne':
                obj = suzanneObj
                break
        }
        scene.remove(meshes.mesh)
        scene.remove(meshes.lineMesh)

        meshes = displayObj(obj)
    }
)
debugObject.subdivide = () =>
{    
    obj = catmullClark(obj)
    scene.remove(meshes.mesh)
    scene.remove(meshes.lineMesh)

    meshes = displayObj(obj)
}
gui.add(debugObject,'subdivide')

/**
 * Lights
 */
 const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
 scene.add(ambientLight)
 
 const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7)
 directionalLight.castShadow = true
 directionalLight.shadow.mapSize.set(1024, 1024)
 directionalLight.shadow.camera.far = 15
 directionalLight.shadow.camera.left = - 7
 directionalLight.shadow.camera.top = 7
 directionalLight.shadow.camera.right = 7
 directionalLight.shadow.camera.bottom = - 7
 directionalLight.position.set(5, 5, 5)
 scene.add(directionalLight)


/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})


/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.position.set(2, 2, 2)
scene.add(camera)

// Controls
const controls = new THREE.OrbitControls(camera, canvas)
controls.enableDamping = true
controls.dampingFactor = 0.1


/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setClearColor(0xeeeeee)


/**
 * Animate
 */
const clock = new THREE.Clock()

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()

    // Update controls
    controls.update()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()
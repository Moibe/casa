<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
  import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
  import { Line2 } from 'three/examples/jsm/lines/Line2.js';
  import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
  import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
  import { studio, type Shape, type PrimitiveKind } from './studio.svelte';
  import { confirmStore } from './confirm.svelte';

  let container: HTMLDivElement;
  let lengthLabel: HTMLDivElement;

  function buildGeometry(kind: PrimitiveKind): THREE.BufferGeometry {
    switch (kind) {
      case 'box':
        return new THREE.BoxGeometry(1, 1, 1);
      case 'sphere':
        return new THREE.SphereGeometry(0.6, 32, 32);
      case 'cylinder':
        return new THREE.CylinderGeometry(0.5, 0.5, 1.2, 32);
      case 'torus':
        return new THREE.TorusGeometry(0.5, 0.2, 16, 64);
      case 'cone':
        return new THREE.ConeGeometry(0.6, 1.2, 32);
    }
  }

  onMount(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(4, 3.5, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0.5, 0);
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.PAN
    };

    type ViewAnim = {
      startTime: number;
      duration: number;
      fromPos: THREE.Vector3;
      toPos: THREE.Vector3;
      fromTarget: THREE.Vector3;
      toTarget: THREE.Vector3;
      mode: 'perspective' | 'top';
    };
    let viewAnim: ViewAnim | null = null;
    let firstViewApply = true;

    function easeInOutCubic(t: number): number {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    const TOP_PHI = 0.012;
    const TOP_OFFSET = Math.tan(TOP_PHI) * 12;

    function applyPolarLimits(mode: 'perspective' | 'top') {
      if (mode === 'top') {
        controls.minPolarAngle = TOP_PHI;
        controls.maxPolarAngle = TOP_PHI;
      } else {
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = Math.PI;
      }
    }

    function focusOnPoint(cx: number, cz: number) {
      if (firstViewApply) return;
      const offset = camera.position.clone().sub(controls.target);
      const newTarget = new THREE.Vector3(cx, controls.target.y, cz);
      const newPos = newTarget.clone().add(offset);
      viewAnim = {
        startTime: performance.now(),
        duration: 600,
        fromPos: camera.position.clone(),
        toPos: newPos,
        fromTarget: controls.target.clone(),
        toTarget: newTarget,
        mode: studio.viewMode
      };
      controls.enableRotate = false;
    }

    function applyView(mode: 'perspective' | 'top') {
      const toPos =
        mode === 'top'
          ? new THREE.Vector3(0, 12, TOP_OFFSET)
          : new THREE.Vector3(4, 3.5, 5);
      const toTarget =
        mode === 'top' ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(0, 0.5, 0);

      if (firstViewApply) {
        camera.position.copy(toPos);
        controls.target.copy(toTarget);
        controls.enableRotate = true;
        applyPolarLimits(mode);
        controls.update();
        firstViewApply = false;
        return;
      }

      viewAnim = {
        startTime: performance.now(),
        duration: 800,
        fromPos: camera.position.clone(),
        toPos,
        fromTarget: controls.target.clone(),
        toTarget,
        mode
      };
      controls.enableRotate = false;
    }

    scene.add(new THREE.AmbientLight(0xfff37a, 0.6));
    const key = new THREE.DirectionalLight(0xffdd00, 1.4);
    key.position.set(5, 8, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.5);
    rim.position.set(-4, 3, -3);
    scene.add(rim);

    const gridMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x1a1300) },
        uFadeDistance: { value: 60.0 }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        uniform vec3 uColor;
        uniform float uFadeDistance;

        float gridLine(vec2 coord, float scale) {
          vec2 g = abs(fract(coord * scale - 0.5) - 0.5) / fwidth(coord * scale);
          return 1.0 - min(min(g.x, g.y), 1.0);
        }

        void main() {
          vec2 c = vWorldPos.xz;
          float minor = gridLine(c, 1.0);
          float major = gridLine(c, 0.1);
          float dist = distance(cameraPosition.xz, vWorldPos.xz);
          float fade = 1.0 - smoothstep(uFadeDistance * 0.4, uFadeDistance, dist);
          float alpha = max(minor * 0.35, major * 0.7) * fade;
          if (alpha < 0.001) discard;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const gridMesh = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), gridMat);
    gridMesh.rotation.x = -Math.PI / 2;
    scene.add(gridMesh);

    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const roomLines = new Map<string, Line2>();

    const ROOM_Y = 0.01;
    const CLOSE_DIST_SQ = 0.04;

    const roomMat = new LineMaterial({
      color: 0x000000,
      linewidth: 14,
      worldUnits: false,
      alphaToCoverage: false
    });
    const dpr = window.devicePixelRatio || 1;
    roomMat.resolution.set(container.clientWidth * dpr, container.clientHeight * dpr);

    const previewMat = new LineMaterial({
      color: 0x000000,
      linewidth: 14,
      worldUnits: false,
      transparent: true,
      opacity: 0.45,
      alphaToCoverage: false
    });
    previewMat.resolution.set(container.clientWidth * dpr, container.clientHeight * dpr);

    const previewLine = new Line2(new LineGeometry(), previewMat);
    previewLine.visible = false;
    scene.add(previewLine);

    function roomVerts(points: { x: number; z: number }[], closed: boolean): number[] {
      const out: number[] = [];
      const len = points.length;
      for (let i = 0; i < len; i++) {
        const p = points[i];
        out.push(p.x, ROOM_Y, p.z);
      }
      if (closed && len > 0) {
        const p = points[0];
        out.push(p.x, ROOM_Y, p.z);
      }
      return out;
    }

    function syncRooms() {
      const ids = new Set(studio.rooms.map((r) => r.id));
      for (const [id, line] of roomLines) {
        if (!ids.has(id)) {
          scene.remove(line);
          line.geometry.dispose();
          roomLines.delete(id);
        }
      }
      const activeId = studio.activeRoomId;
      for (const room of studio.rooms) {
        let line = roomLines.get(room.id);
        if (!line) {
          line = new Line2(new LineGeometry(), roomMat);
          roomLines.set(room.id, line);
          scene.add(line);
        }
        if (room.id !== activeId || room.points.length < 2) {
          line.visible = false;
          continue;
        }
        const verts = roomVerts(room.points, room.closed);
        const oldGeo = line.geometry;
        const newGeo = new LineGeometry();
        newGeo.setPositions(verts);
        line.geometry = newGeo;
        line.computeLineDistances();
        oldGeo.dispose();
        line.visible = true;
      }
    }

    function pickFloor(ev: { clientX: number; clientY: number }): THREE.Vector3 | null {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const out = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(floorPlane, out)) return out;
      return null;
    }

    function updatePreview(cursor: THREE.Vector3 | null) {
      const room = studio.drawingRoom;
      if (!room || room.points.length === 0 || !cursor) {
        previewLine.visible = false;
        return;
      }
      const last = room.points[room.points.length - 1];
      const verts = [last.x, ROOM_Y, last.z, cursor.x, ROOM_Y, cursor.z];
      (previewLine.geometry as LineGeometry).setPositions(verts);
      previewLine.computeLineDistances();
      previewLine.geometry.computeBoundingSphere();
      previewLine.visible = true;
    }

    const handleGeo = new THREE.SphereGeometry(0.18, 16, 12);
    const handleMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const handles: THREE.Mesh[] = [];
    let draggingHandleIndex: number | null = null;
    let altDragPending: { nodeIdx: number } | null = null;

    function syncHandles() {
      const editingRoom = studio.editingContourRoom;
      while (handles.length > 0) {
        const h = handles.pop()!;
        scene.remove(h);
      }
      if (!editingRoom) return;
      for (let i = 0; i < editingRoom.points.length; i++) {
        const p = editingRoom.points[i];
        const mesh = new THREE.Mesh(handleGeo, handleMat);
        mesh.position.set(p.x, ROOM_Y + 0.02, p.z);
        mesh.userData.handleIndex = i;
        scene.add(mesh);
        handles.push(mesh);
      }
    }

    function updateHandlePositions() {
      const editingRoom = studio.editingContourRoom;
      if (!editingRoom) return;
      for (let i = 0; i < handles.length && i < editingRoom.points.length; i++) {
        const p = editingRoom.points[i];
        handles[i].position.set(p.x, ROOM_Y + 0.02, p.z);
      }
    }

    function pickHandle(ev: { clientX: number; clientY: number }): number | null {
      if (handles.length === 0) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(handles, false);
      if (hits.length === 0) return null;
      return hits[0].object.userData.handleIndex as number;
    }

    function pickEdge(
      hit: THREE.Vector3,
      points: { x: number; z: number }[],
      threshold: number
    ): { segmentIndex: number; x: number; z: number } | null {
      const N = points.length;
      if (N < 3) return null;
      let best: { segmentIndex: number; distSq: number; x: number; z: number } | null = null;
      for (let i = 0; i < N; i++) {
        const a = points[i];
        const b = points[(i + 1) % N];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len2 = dx * dx + dz * dz;
        if (len2 === 0) continue;
        let t = ((hit.x - a.x) * dx + (hit.z - a.z) * dz) / len2;
        t = Math.max(0.05, Math.min(0.95, t));
        const px = a.x + t * dx;
        const pz = a.z + t * dz;
        const dSq = (hit.x - px) ** 2 + (hit.z - pz) ** 2;
        if (!best || dSq < best.distSq) {
          best = { segmentIndex: i, distSq: dSq, x: px, z: pz };
        }
      }
      if (best && best.distSq < threshold * threshold) {
        return { segmentIndex: best.segmentIndex, x: best.x, z: best.z };
      }
      return null;
    }

    const meshes = new Map<string, THREE.Mesh>();
    const selectionRingMat = new THREE.MeshBasicMaterial({ color: 0x1a1300 });
    const selectionRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.03, 8, 48),
      selectionRingMat
    );
    selectionRing.rotation.x = Math.PI / 2;
    selectionRing.visible = false;
    scene.add(selectionRing);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const transform = new TransformControls(camera, renderer.domElement);
    transform.setSize(0.9);
    const transformHelper = transform.getHelper();
    scene.add(transformHelper);
    transformHelper.visible = false;

    transform.addEventListener('dragging-changed', (e) => {
      controls.enabled = !e.value;
    });
    transform.addEventListener('objectChange', () => {
      const sel = studio.selected;
      const obj = transform.object;
      if (!sel || !obj) return;
      sel.position.x = obj.position.x;
      sel.position.y = obj.position.y;
      sel.position.z = obj.position.z;
      sel.rotation.x = obj.rotation.x;
      sel.rotation.y = obj.rotation.y;
      sel.rotation.z = obj.rotation.z;
      sel.scale.x = obj.scale.x;
      sel.scale.y = obj.scale.y;
      sel.scale.z = obj.scale.z;
    });

    function attachGizmo(id: string) {
      const m = meshes.get(id);
      if (!m) return;
      transform.attach(m);
      transformHelper.visible = true;
    }
    function detachGizmo() {
      transform.detach();
      transformHelper.visible = false;
    }

    function syncMesh(shape: Shape) {
      let mesh = meshes.get(shape.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          buildGeometry(shape.kind),
          new THREE.MeshStandardMaterial({ color: shape.color, metalness: 0.2, roughness: 0.45 })
        );
        mesh.userData.id = shape.id;
        meshes.set(shape.id, mesh);
        scene.add(mesh);
      }
      (mesh.material as THREE.MeshStandardMaterial).color.set(shape.color);
      mesh.position.set(shape.position.x, shape.position.y, shape.position.z);
      mesh.scale.set(shape.scale.x, shape.scale.y, shape.scale.z);
      mesh.rotation.set(shape.rotation.x, shape.rotation.y, shape.rotation.z);
    }

    function syncAll() {
      const activeId = studio.activeRoomId;
      const visibleShapes = studio.shapes.filter((s) => s.roomId === activeId);
      const ids = new Set(visibleShapes.map((s) => s.id));
      for (const [id, mesh] of meshes) {
        if (!ids.has(id)) {
          scene.remove(mesh);
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
          meshes.delete(id);
        }
      }
      for (const shape of visibleShapes) syncMesh(shape);

      const sel = studio.selected;
      if (sel && sel.roomId === activeId) {
        const m = meshes.get(sel.id)!;
        selectionRing.visible = true;
        selectionRing.position.copy(m.position);
      } else {
        selectionRing.visible = false;
        detachGizmo();
      }

      if (transform.object && (!sel || transform.object.userData.id !== sel.id)) {
        detachGizmo();
      }
    }

    function applyTheme(t: 'default' | 'blueprint') {
      if (t === 'blueprint') {
        roomMat.color.set(0xffffff);
        previewMat.color.set(0xffffff);
        selectionRingMat.color.set(0xffffff);
        handleMat.color.set(0xffffff);
        (gridMat.uniforms.uColor.value as THREE.Color).set(0xa9c4e8);
      } else {
        roomMat.color.set(0x000000);
        previewMat.color.set(0x000000);
        selectionRingMat.color.set(0x1a1300);
        handleMat.color.set(0x000000);
        (gridMat.uniforms.uColor.value as THREE.Color).set(0x1a1300);
      }
    }

    let prevActiveRoomId: string | null = studio.activeRoomId;
    let firstActiveApply = true;

    const stopEffects = $effect.root(() => {
      $effect(() => {
        applyTheme(studio.theme);
      });
      $effect(() => {
        applyView(studio.viewMode);
      });
      $effect(() => {
        const id = studio.activeRoomId;
        if (firstActiveApply) {
          prevActiveRoomId = id;
          firstActiveApply = false;
          return;
        }
        if (id === prevActiveRoomId) return;
        prevActiveRoomId = id;
        if (!id) return;
        const room = studio.rooms.find((r) => r.id === id);
        if (!room || room.points.length === 0) return;
        let sx = 0;
        let sz = 0;
        for (const p of room.points) {
          sx += p.x;
          sz += p.z;
        }
        focusOnPoint(sx / room.points.length, sz / room.points.length);
      });
      $effect(() => {
        studio.rooms.forEach((r) => {
          r.points.length;
          r.points.forEach((p) => {
            p.x;
            p.z;
          });
          r.closed;
        });
        studio.activeRoomId;
        syncRooms();
      });
      $effect(() => {
        if (!studio.drawingRoomId) {
          previewLine.visible = false;
          hideLengthLabel();
        }
      });
      $effect(() => {
        studio.editingContourRoomId;
        const room = studio.editingContourRoom;
        if (room) room.points.length;
        syncHandles();
      });
      $effect(() => {
        const room = studio.editingContourRoom;
        if (!room) return;
        room.points.forEach((p) => {
          p.x;
          p.z;
        });
        updateHandlePositions();
      });
      $effect(() => {
        studio.shapes.forEach((s) => {
          s.color;
          s.position.x;
          s.position.y;
          s.position.z;
          s.scale.x;
          s.scale.y;
          s.scale.z;
          s.rotation.x;
          s.rotation.y;
          s.rotation.z;
          s.roomId;
        });
        studio.selectedId;
        studio.activeRoomId;
        syncAll();
      });
    });

    function pickMesh(ev: MouseEvent): string | null {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...meshes.values()], false);
      return hits.length ? (hits[0].object.userData.id as string) : null;
    }

    let downX = 0;
    let downY = 0;
    let downAt = 0;

    function onPointerDown(ev: PointerEvent) {
      if (ev.button !== 0) return;
      downX = ev.clientX;
      downY = ev.clientY;
      downAt = performance.now();

      if (studio.editingContourRoomId) {
        const room = studio.editingContourRoom;
        const idx = pickHandle(ev);
        if (idx !== null && room) {
          if (ev.altKey && room.closed) {
            // Defer split: wait for first move to detect drag direction
            altDragPending = { nodeIdx: idx };
          } else {
            draggingHandleIndex = idx;
          }
          controls.enabled = false;
          renderer.domElement.setPointerCapture(ev.pointerId);
          return;
        }
        if (room) {
          const hit = pickFloor(ev);
          if (hit) {
            const edgeHit = pickEdge(hit, room.points, 0.25);
            if (edgeHit) {
              const insertAt = edgeHit.segmentIndex + 1;
              studio.insertRoomPoint(
                studio.editingContourRoomId,
                insertAt,
                edgeHit.x,
                edgeHit.z
              );
              draggingHandleIndex = insertAt;
              controls.enabled = false;
              renderer.domElement.setPointerCapture(ev.pointerId);
              return;
            }
          }
        }
      }
    }

    function onPointerUp(ev: PointerEvent) {
      if (ev.button !== 0) return;
      if (altDragPending) {
        altDragPending = null;
        controls.enabled = true;
        try {
          renderer.domElement.releasePointerCapture(ev.pointerId);
        } catch {
          // noop
        }
        return;
      }
      if (draggingHandleIndex !== null) {
        // Snap-and-merge: if open polygon and dragging an endpoint near the other endpoint, close it
        if (studio.editingContourRoomId) {
          const room = studio.editingContourRoom;
          if (room && !room.closed && room.points.length >= 4) {
            const N = room.points.length;
            const idx = draggingHandleIndex;
            if (idx === 0 || idx === N - 1) {
              const otherIdx = idx === 0 ? N - 1 : 0;
              const a = room.points[idx];
              const b = room.points[otherIdx];
              const dx = a.x - b.x;
              const dz = a.z - b.z;
              if (dx * dx + dz * dz < CLOSE_DIST_SQ) {
                studio.mergeAndClose(studio.editingContourRoomId, idx);
              }
            }
          }
        }
        draggingHandleIndex = null;
        controls.enabled = true;
        try {
          renderer.domElement.releasePointerCapture(ev.pointerId);
        } catch {
          // noop
        }
        return;
      }
      if (transform.dragging) return;
      const dist = Math.hypot(ev.clientX - downX, ev.clientY - downY);
      const elapsed = performance.now() - downAt;
      if (dist > 5 || elapsed > 600) return;

      if (studio.drawingRoomId) {
        const room = studio.drawingRoom;
        if (!room) return;
        const hit = pickFloor(ev);
        if (!hit) return;
        if (room.points.length >= 3) {
          const first = room.points[0];
          const dx = first.x - hit.x;
          const dz = first.z - hit.z;
          if (dx * dx + dz * dz < CLOSE_DIST_SQ) {
            studio.closeDrawingRoom();
            return;
          }
        }
        studio.addRoomPoint(hit.x, hit.z);
        return;
      }

      const id = pickMesh(ev);
      studio.select(id);
    }

    function hideLengthLabel() {
      if (lengthLabel) lengthLabel.style.display = 'none';
    }

    function onPointerMove(ev: PointerEvent) {
      if (altDragPending && studio.editingContourRoomId) {
        const room = studio.editingContourRoom;
        if (!room) {
          altDragPending = null;
        } else {
          const N = room.points.length;
          const i = altDragPending.nodeIdx;
          const node = room.points[i];
          const hit = pickFloor(ev);
          if (hit) {
            const dx = hit.x - node.x;
            const dz = hit.z - node.z;
            const len = Math.hypot(dx, dz);
            if (len > 0.15) {
              const prev = room.points[(i - 1 + N) % N];
              const next = room.points[(i + 1) % N];
              const pdx = prev.x - node.x;
              const pdz = prev.z - node.z;
              const ndx = next.x - node.x;
              const ndz = next.z - node.z;
              const plen = Math.hypot(pdx, pdz) || 1;
              const nlen = Math.hypot(ndx, ndz) || 1;
              const dotPrev = (dx * pdx + dz * pdz) / (len * plen);
              const dotNext = (dx * ndx + dz * ndz) / (len * nlen);
              const towardNext = dotNext >= dotPrev;
              const newIdx = studio.splitRoomNode(
                studio.editingContourRoomId,
                i,
                towardNext
              );
              altDragPending = null;
              if (newIdx >= 0) {
                draggingHandleIndex = newIdx;
                studio.updateRoomPoint(
                  studio.editingContourRoomId,
                  newIdx,
                  hit.x,
                  hit.z
                );
              }
            }
          }
          return;
        }
      }

      if (draggingHandleIndex !== null && studio.editingContourRoomId) {
        const hit = pickFloor(ev);
        if (hit) {
          studio.updateRoomPoint(studio.editingContourRoomId, draggingHandleIndex, hit.x, hit.z);
        }
        return;
      }

      if (!studio.drawingRoomId) {
        if (previewLine.visible) previewLine.visible = false;
        hideLengthLabel();
        return;
      }
      const cursor = pickFloor(ev);
      updatePreview(cursor);

      const room = studio.drawingRoom;
      if (!room || room.points.length === 0 || !cursor) {
        hideLengthLabel();
        return;
      }
      const last = room.points[room.points.length - 1];
      const dx = cursor.x - last.x;
      const dz = cursor.z - last.z;
      const dist = Math.hypot(dx, dz);
      const rect = renderer.domElement.getBoundingClientRect();
      lengthLabel.style.left = ev.clientX - rect.left + 14 + 'px';
      lengthLabel.style.top = ev.clientY - rect.top + 14 + 'px';
      lengthLabel.textContent = dist.toFixed(2) + ' m';
      lengthLabel.style.display = 'block';
    }

    function onPointerLeave() {
      hideLengthLabel();
    }

    function onContextMenu(ev: MouseEvent) {
      if (studio.editingContourRoomId) {
        ev.preventDefault();
        studio.cancelEditingContour();
        return;
      }
      if (!studio.drawingRoomId) return;
      ev.preventDefault();
      studio.cancelDrawingRoom();
    }

    function onDblClick(ev: MouseEvent) {
      const id = pickMesh(ev);
      if (id) {
        studio.select(id);
        attachGizmo(id);
      } else {
        detachGizmo();
      }
    }

    function onKey(ev: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select';

      if (!typing && ev.key === 'Escape') {
        if (studio.editingContourRoomId) studio.cancelEditingContour();
        else if (studio.drawingRoomId) studio.cancelDrawingRoom();
        else detachGizmo();
      } else if (!typing && ev.key === 'Enter' && studio.editingContourRoomId) {
        ev.preventDefault();
        studio.finishEditingContour();
      } else if (!typing && ev.key === 'Enter' && studio.drawingRoomId) {
        ev.preventDefault();
        studio.closeDrawingRoom();
      } else if (!typing && (ev.key === 'Delete' || ev.key === 'Backspace')) {
        const sel = studio.selected;
        if (!sel) return;
        ev.preventDefault();
        const id = sel.id;
        const kind = sel.kind;
        confirmStore
          .ask({
            title: 'Eliminar figura',
            message: `¿Eliminar la figura "${kind}"? Esta acción no se puede deshacer.`,
            confirmText: 'Eliminar',
            danger: true
          })
          .then((ok) => {
            if (ok) {
              detachGizmo();
              studio.remove(id);
            }
          });
      } else if (!typing && (ev.key === 'w' || ev.key === 'W')) transform.setMode('translate');
      else if (!typing && (ev.key === 'e' || ev.key === 'E')) transform.setMode('rotate');
      else if (!typing && (ev.key === 'r' || ev.key === 'R')) transform.setMode('scale');
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    renderer.domElement.addEventListener('dblclick', onDblClick);
    window.addEventListener('keydown', onKey);

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      const r = window.devicePixelRatio || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      roomMat.resolution.set(w * r, h * r);
      previewMat.resolution.set(w * r, h * r);
    };
    window.addEventListener('resize', onResize);

    let raf = 0;
    const tick = (now: number) => {
      if (viewAnim) {
        const t = Math.min((now - viewAnim.startTime) / viewAnim.duration, 1);
        const eased = easeInOutCubic(t);
        camera.position.lerpVectors(viewAnim.fromPos, viewAnim.toPos, eased);
        controls.target.lerpVectors(viewAnim.fromTarget, viewAnim.toTarget, eased);
        if (t >= 1) {
          applyPolarLimits(viewAnim.mode);
          controls.enableRotate = true;
          viewAnim = null;
        }
      }
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      stopEffects();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      renderer.domElement.removeEventListener('dblclick', onDblClick);
      transform.dispose();
      controls.dispose();
      for (const mesh of meshes.values()) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      for (const line of roomLines.values()) {
        line.geometry.dispose();
      }
      previewLine.geometry.dispose();
      roomMat.dispose();
      previewMat.dispose();
      handleGeo.dispose();
      handleMat.dispose();
      gridMesh.geometry.dispose();
      gridMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  });
</script>

<div bind:this={container} class="scene" class:drawing={studio.drawingRoomId}>
  <div bind:this={lengthLabel} class="length-label"></div>
</div>

<style>
  .scene {
    width: 100%;
    height: 100%;
    display: block;
    cursor: grab;
    position: relative;
  }
  .length-label {
    position: absolute;
    display: none;
    pointer-events: none;
    background: #1a1300;
    color: #ffdd00;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    white-space: nowrap;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    z-index: 2;
  }
  .scene:active {
    cursor: grabbing;
  }
  .scene.drawing,
  .scene.drawing:active {
    cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='12' cy='12' r='7' fill='black'/></svg>")
        12 12,
      crosshair;
  }
  :global(.theme-blueprint) .scene.drawing,
  :global(.theme-blueprint) .scene.drawing:active {
    cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='12' cy='12' r='7' fill='white'/></svg>")
        12 12,
      crosshair;
  }
</style>

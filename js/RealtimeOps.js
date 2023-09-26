function UpdateEditorFromEvents(editor, eventData) {
  const operation = eventData.operation;
  const json = editor.toJSON();
  let updatedJson = null;
  if (operation === "AddObjectCommand") {
    updatedJson = handleAddObject(json, eventData.object);
  } else if (
    ["SetPositionCommand", "SetRotationCommand", "SetScaleCommand"].includes(
      operation
    )
  ) {
    updatedJson = objectPropertyChange(editor, eventData);
  } else {
    return;
  }
  editor.clear();
  editor.fromJSON(updatedJson);
}

function handleAddObject(currJson, updatedObject) {
  initializeEditor(currJson);

  if (updatedObject.materials) {
    currJson.scene.materials = currJson.scene.materials.concat(
      updatedObject.materials
    );
  }

  if (updatedObject.geometries) {
    currJson.scene.geometries = currJson.scene.geometries.concat(
      updatedObject.geometries
    );
  }

  if (updatedObject.object) {
    currJson.scene.object.children = currJson.scene.object.children.concat(
      updatedObject.object
    );
  }

  return currJson;
}

function objectPropertyChange(editor, eventData) {
  const { objectId, newValue, operation } = eventData;
  const modifiedObject = editor.objectByUuid(objectId);
  if (!modifiedObject) {
    return;
  }
  if (operation === "SetPositionCommand") {
    modifiedObject.position.copy(newValue);
  } else if (operation === "SetRotationCommand") {
    modifiedObject.rotation.copy(newValue);
  } else if (operation === "SetScaleCommand") {
    modifiedObject.scale.copy(newValue);
  }
  modifiedObject.updateMatrixWorld(true);
  return editor.toJSON();
}

function initializeEditor(currJson) {
  if (currJson.scene.materials == null) {
    currJson.scene.materials = [];
  }
  if (currJson.scene.geometries == null) {
    currJson.scene.geometries = [];
  }
  if (currJson.scene.object.children == null) {
    currJson.scene.object.children = [];
  }
}

export { UpdateEditorFromEvents };

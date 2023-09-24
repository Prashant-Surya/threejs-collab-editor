import { UIPanel, UIRow } from "./libs/ui.js";

function MenubarSpaces(editor) {
  const strings = editor.strings;

  const container = new UIPanel();
  container.setClass("menu");

  const title = new UIPanel();
  title.setClass("title");
  title.setTextContent(strings.getKey("menubar/spaces/members"));
  container.add(title);

  const options = new UIPanel();
  options.setClass("options");
  options.setId("space-members");
  container.add(options);

  let option = new UIRow();
  option.setClass("option");
  option.setTextContent("Option 1");
  option.onClick(() => {
    console.log("Clicked");
  });
  options.add(option);

  return container;
}

export { MenubarSpaces };

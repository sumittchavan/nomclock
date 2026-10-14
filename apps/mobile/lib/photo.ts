import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { decode } from "base64-arraybuffer";

export type PickSource = "camera" | "library";

export interface Picked { uri: string; width: number; height: number }

/** Returns the picked photo, or null if the user cancelled. */
export async function pickPhoto(source: PickSource): Promise<Picked | null> {
  const perm = source === "camera"
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error(source === "camera"
    ? "Camera access is off. Turn it on for NutriSnap in Settings to photograph meals."
    : "Photo access is off. Turn it on for NutriSnap in Settings to choose meal photos.");
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, exif: false, allowsEditing: false };
  const res = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled) return null;
  const a = res.assets[0];
  return { uri: a.uri, width: a.width, height: a.height };
}

/**
 * Resize to 1600px on the long side and re-encode as JPEG. Re-encoding drops
 * all EXIF metadata, including GPS location, before anything leaves the phone.
 */
export async function preparePhoto(p: Picked, maxSide = 1600): Promise<ArrayBuffer> {
  const ctx = ImageManipulator.manipulate(p.uri);
  if (Math.max(p.width, p.height) > maxSide) {
    ctx.resize(p.width >= p.height ? { width: maxSide } : { height: maxSide });
  }
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  if (!out.base64) throw new Error("Couldn't process that photo");
  return decode(out.base64);
}

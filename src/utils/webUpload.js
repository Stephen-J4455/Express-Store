const getImageExtension = (uri) => {
  const cleanUri = uri?.split("?")[0] || "";
  const fileNameSegment = cleanUri.split("/").pop() || "";
  const ext = fileNameSegment.includes(".")
    ? fileNameSegment.split(".").pop()?.toLowerCase()
    : null;

  if (!ext || ext.length > 5) return "jpg";
  return ext === "jpeg" ? "jpg" : ext;
};

export const getImageContentType = (uri, fallbackType = null) => {
  if (fallbackType && typeof fallbackType === "string") return fallbackType;
  const ext = getImageExtension(uri);
  return `image/${ext === "jpg" ? "jpeg" : ext}`;
};

const fetchBlobFromUri = async (uri) => {
  const response = await fetch(uri);
  return await response.blob();
};

const xhrBlobFromUri = (uri) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", uri, true);
    xhr.responseType = "blob";
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 0) {
        resolve(xhr.response);
        return;
      }
      reject(new Error(`Failed to read selected file (status ${xhr.status})`));
    };
    xhr.onerror = () => {
      reject(new Error("Failed to read selected file"));
    };
    xhr.send();
  });

export const getWebUploadPayload = async ({
  uri,
  pickedFile = null,
  preferredContentType = null,
}) => {
  let fileBody = pickedFile instanceof Blob ? pickedFile : null;

  if (!fileBody) {
    try {
      fileBody = await fetchBlobFromUri(uri);
    } catch (_fetchError) {
      fileBody = await xhrBlobFromUri(uri);
    }
  }

  const contentType = getImageContentType(
    uri,
    preferredContentType || fileBody?.type || null,
  );

  return { fileBody, contentType };
};

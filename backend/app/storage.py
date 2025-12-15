import os
from fastapi import UploadFile
from .config import UPLOAD_FOLDER

def save_upload_file(upload_file: UploadFile, destination: str = None):
    if destination:
        if os.path.isabs(destination):
            dest = destination
        else:
            dest = os.path.join(UPLOAD_FOLDER, destination)
    else:
        dest = os.path.join(UPLOAD_FOLDER, upload_file.filename)

    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as buffer:
        data = upload_file.file.read()
        buffer.write(data)
    return dest

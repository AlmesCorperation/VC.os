#include <archive.h>
#include <archive_entry.h>
#include <iostream>

/**
 * VC.os ISO Creator Utility
 * 
 * This script demonstrates how to use libarchive to generate a standard
 * ISO 9660 disk image. In VC.os, this logic is used by the VCEngine
 * to export games as bootable media.
 */

int main() {
    struct archive *a;
    struct archive_entry *entry;
    
    // 1. Create the archive object
    a = archive_write_new();

    // 2. Set the format to ISO 9660
    // This is the key line that tells libarchive to make an ISO
    archive_write_set_format_iso9660(a);

    // 3. Open the output file
    archive_write_open_filename(a, "my_disk_image.iso");

    // 4. Create a file entry inside the ISO
    entry = archive_entry_new();
    archive_entry_set_pathname(entry, "hello_world.txt");
    archive_entry_set_size(entry, 12); // Length of "Hello World!"
    archive_entry_set_filetype(entry, AE_IFREG);
    archive_entry_set_perm(entry, 0644);

    // 5. Write the header and data
    archive_write_header(a, entry);
    archive_write_data(a, "Hello World!", 12);

    // 6. Cleanup
    archive_entry_free(entry);
    archive_write_close(a);
    archive_write_free(a);

    std::cout << "ISO created successfully!" << std::endl;
    return 0;
}
